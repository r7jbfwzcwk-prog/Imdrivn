// Stripe Checkout. Membership is a $5 AUD/month subscription.
// Boost is a one-off $5 AUD payment. No charge is created when membership is off.
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
    if (!stripeKey) return json({ error: "Checkout is not ready yet." }, 503);
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sign in first." }, 401);
    const user = userData.user;
    const admin = createClient(url, service);
    const setting = await admin.from("site_settings").select("value").eq("key", "membership_enabled").maybeSingle();
    const enabled = setting.data?.value === true;
    const body = await req.json().catch(() => ({}));
    const kind = body.kind === "boost" ? "boost" : "membership";
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

    const listingId = String(body.listingId || "");
    const listing = await admin.from("listings").select("id,user_id,status").eq("id", listingId).maybeSingle();
    if (!listing.data || listing.data.user_id !== user.id || listing.data.status !== "active") {
      return json({ error: "You can only boost your own live ad." }, 403);
    }
    if (!enabled) return json({ error: "Paid boosts are not open." }, 403);
    const profile = await admin.from("profiles").select("membership_status").eq("id", user.id).maybeSingle();
    const status = profile.data?.membership_status;
    if (status !== "active" && status !== "trialing") return json({ error: "An active membership is required." }, 403);
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
