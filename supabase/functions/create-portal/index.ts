// Opens the Stripe Billing Portal so a member can manage or cancel.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey) return json({ error: "Billing portal is not ready yet." }, 503);
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Sign in first." }, 401);
    const admin = createClient(url, service);
    const profile = await admin.from("profiles").select("stripe_customer_id").eq("id", userData.user.id).maybeSingle();
    const customer = profile.data?.stripe_customer_id;
    if (!customer) return json({ error: "No billing account yet." }, 404);
    const body = await req.json().catch(() => ({}));
    const origin = String(body.origin || req.headers.get("origin") || "").replace(/\/$/, "");
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: "Bearer " + stripeKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ customer, return_url: origin + "/#/garage" }).toString()
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data.error?.message || "Could not open billing." }, 500);
    return json({ url: data.url });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Could not open billing." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
