// Verifies Stripe signatures, then records membership or applies a paid boost.
// Dashboard events to subscribe: checkout.session.completed,
// customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted, invoice.paid, invoice.payment_failed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const payload = await req.text();
  const header = req.headers.get("stripe-signature") || "";
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  if (!secret || !(await verifyStripe(payload, header, secret))) {
    return new Response("Invalid signature", { status: 400 });
  }
  const event = JSON.parse(payload);
  const admin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  const type = event.type as string;
  const obj = event.data?.object || {};
  try {
    if (type === "checkout.session.completed") {
      if (obj.mode === "payment" && obj.metadata?.kind === "boost" && obj.payment_status === "paid") {
        await admin.rpc("apply_paid_boost", {
          p_listing_id: obj.metadata.listing_id,
          p_user_id: obj.metadata.user_id || obj.client_reference_id,
          p_session_id: obj.id
        });
      }
      if (obj.mode === "payment" && obj.metadata?.kind === "vin" && obj.payment_status === "paid" && obj.metadata.order_id) {
        await admin.from("vin_check_orders").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", obj.metadata.order_id).eq("status", "pending_payment");
        const fn = (Deno.env.get("SUPABASE_URL") || "") + "/functions/v1/ppsr-vin-search";
        await fetch(fn, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ orderId: obj.metadata.order_id })
        });
      }
      if (obj.mode === "subscription") {
        await saveMembership(admin, obj.metadata?.user_id || obj.client_reference_id, {
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.subscription,
          membership_status: "trialing"
        });
      }
    }
    if (type === "customer.subscription.created" || type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const userId = obj.metadata?.user_id;
      const status = type === "customer.subscription.deleted" ? "canceled" : obj.status;
      const end = obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null;
      if (userId) {
        await saveMembership(admin, userId, {
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.id,
          membership_status: status || "none",
          current_period_end: end
        });
      } else if (obj.customer) {
        await admin.from("profiles").update({
          membership_status: status || "none",
          current_period_end: end,
          stripe_subscription_id: obj.id
        }).eq("stripe_customer_id", obj.customer);
      }
    }
    if (type === "invoice.paid" || type === "invoice.payment_failed") {
      const status = type === "invoice.paid" ? "active" : "past_due";
      const end = obj.lines?.data?.[0]?.period?.end ? new Date(obj.lines.data[0].period.end * 1000).toISOString() : null;
      if (obj.customer) {
        const patch: Record<string, string> = { membership_status: status };
        if (end) patch.current_period_end = end;
        await admin.from("profiles").update(patch).eq("stripe_customer_id", obj.customer);
      }
    }
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Webhook failed", { status: 500 });
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});

async function saveMembership(admin: ReturnType<typeof createClient>, userId: string, patch: Record<string, string | null>) {
  if (!userId) return;
  const clean: Record<string, string | null> = {};
  Object.entries(patch).forEach(([key, value]) => { if (value) clean[key] = value; });
  if (!Object.keys(clean).length) return;
  await admin.from("profiles").update(clean).eq("id", userId);
}

async function verifyStripe(payload: string, header: string, secret: string) {
  const bits = Object.fromEntries(header.split(",").map((part) => {
    const i = part.indexOf("=");
    return [part.slice(0, i), part.slice(i + 1)];
  }));
  const stamp = Number(bits.t || 0);
  if (!stamp || Math.abs(Date.now() / 1000 - stamp) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bits.t + "." + payload));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return header.split(",").some((part) => part.startsWith("v1=") && part.slice(3) === hex);
}
