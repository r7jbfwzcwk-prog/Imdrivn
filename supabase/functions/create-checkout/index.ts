// Stripe Checkout. Membership is a $5 AUD/month subscription.
// Boost is a one-off $5 AUD payment for any signed-in owner, even while membership is off.
// Top Ad is a one-off pin: 3 days $3, 5 days $5, 7 days $6 AUD.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROMO_END = Date.parse("2026-12-31T23:59:59+10:00");
const TRIAL_END = Math.floor(Date.parse("2027-01-01T00:00:00+10:00") / 1000);

function form(body: Record<string, string>) {
  return new URLSearchParams(body).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sign in first." }, 401);
    const user = userData.user;
    const admin = createClient(url, service);
    const setting = await admin.from("site_settings").select("value").eq("key", "membership_enabled").maybeSingle();
    const enabled = setting.data?.value === true;
    const body = await req.json().catch(() => ({}));
    const kind = body.kind === "boost" ? "boost" : body.kind === "boost-status" ? "boost-status" : body.kind === "top" ? "top" : body.kind === "top-status" ? "top-status" : body.kind === "vin" ? "vin" : body.kind === "vin-status" ? "vin-status" : "membership";
    if (kind === "boost-status" || kind === "vin-status" || kind === "top-status") {
      const missing: string[] = [];
      if (!stripeKey) missing.push("STRIPE_SECRET_KEY");
      if (!webhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
      return json({ ready: missing.length === 0, missing });
    }
    if (!stripeKey) return json({ error: "Checkout is not ready yet.", missing: ["STRIPE_SECRET_KEY"] }, 503);
    const origin = String(body.origin || req.headers.get("origin") || "").replace(/\/$/, "");
    if (!origin) return json({ error: "Missing site address." }, 400);

    if (kind === "membership") {
      if (!enabled) return json({ error: "Membership is not open yet." }, 403);
      const code = String(body.code || "").trim().toUpperCase();
      const trial: Record<string, string> = {};
      if (code) {
        if (code !== "OGMEMBER" || Date.now() > PROMO_END) return json({ error: "That code is not valid." }, 400);
        trial["subscription_data[trial_end]"] = String(TRIAL_END);
      } else {
        trial["subscription_data[trial_period_days]"] = "30";
      }
      const session = await stripe(stripeKey, form({
        mode: "subscription",
        "payment_method_collection": "always",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "aud",
        "line_items[0][price_data][unit_amount]": "500",
        "line_items[0][price_data][recurring][interval]": "month",
        "line_items[0][price_data][product_data][name]": "IM DRIVN membership",
        success_url: origin + "/#/membership?paid=1",
        cancel_url: origin + "/#/membership",
        client_reference_id: user.id,
        "metadata[user_id]": user.id,
        "metadata[kind]": "membership",
        "subscription_data[metadata][user_id]": user.id,
        customer_email: user.email || "",
        ...trial
      }));
      return json({ url: session.url });
    }

    if (kind === "vin") {
      const vin = String(body.vin || "").trim().toUpperCase();
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return json({ error: "VIN must be 17 characters and cannot include I, O, or Q." }, 400);
      const email = String(body.email || user.email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Add a valid email so we can send the report." }, 400);
      const states = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
      const plate = String(body.state || "").trim().toUpperCase();
      const rego = String(body.rego || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
      const listingId = /^[0-9a-f-]{36}$/i.test(String(body.listingId || "")) ? String(body.listingId) : null;
      const created = await admin.from("vin_check_orders").insert({
        vin,
        email,
        user_id: user.id,
        listing_id: listingId,
        rego: rego || null,
        plate_state: states.includes(plate) ? plate : null,
        status: "pending_payment"
      }).select("id").single();
      if (created.error || !created.data) return json({ error: created.error?.message || "Could not start that order." }, 500);
      const orderId = created.data.id as string;
      const session = await stripe(stripeKey, form({
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "aud",
        "line_items[0][price_data][unit_amount]": "1000",
        "line_items[0][price_data][product_data][name]": "IM DRIVN VIN report",
        success_url: origin + "/#/vin/r/" + orderId,
        cancel_url: origin + "/#/vin",
        client_reference_id: user.id,
        "metadata[user_id]": user.id,
        "metadata[kind]": "vin",
        "metadata[order_id]": orderId
      }));
      return json({ url: session.url, orderId });
    }

    if (kind === "top") {
      const days = Number(body.days);
      const amount = days === 3 ? 300 : days === 5 ? 500 : days === 7 ? 600 : 0;
      if (!amount) return json({ error: "Pick 3, 5, or 7 days." }, 400);
      const listingId = String(body.listingId || "");
      const listing = await admin.from("listings").select("id,user_id,status").eq("id", listingId).maybeSingle();
      if (!listing.data || listing.data.user_id !== user.id || listing.data.status !== "active") {
        return json({ error: "You can only pin your own live ad." }, 403);
      }
      const session = await stripe(stripeKey, form({
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "aud",
        "line_items[0][price_data][unit_amount]": String(amount),
        "line_items[0][price_data][product_data][name]": "IM DRIVN Top Ad (" + days + " days)",
        success_url: origin + "/#/garage/ads?top=1",
        cancel_url: origin + "/#/garage/ads",
        client_reference_id: user.id,
        "metadata[user_id]": user.id,
        "metadata[kind]": "top",
        "metadata[listing_id]": listingId,
        "metadata[days]": String(days)
      }));
      return json({ url: session.url });
    }

    const listingId = String(body.listingId || "");
    const listing = await admin.from("listings").select("id,user_id,status").eq("id", listingId).maybeSingle();
    if (!listing.data || listing.data.user_id !== user.id || listing.data.status !== "active") {
      return json({ error: "You can only boost your own live ad." }, 403);
    }
    const session = await stripe(stripeKey, form({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "aud",
      "line_items[0][price_data][unit_amount]": "500",
      "line_items[0][price_data][product_data][name]": "IM DRIVN boost",
      success_url: origin + "/#/garage/ads?boost=1",
      cancel_url: origin + "/#/garage/ads",
      client_reference_id: user.id,
      "metadata[user_id]": user.id,
      "metadata[kind]": "boost",
      "metadata[listing_id]": listingId
    }));
    return json({ url: session.url });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Checkout failed." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

async function stripe(key: string, payload: string) {
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body: payload
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Stripe refused that checkout.");
  return data;
}
