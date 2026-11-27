// Public PPSR status for the VIN check. Anyone can read the current flag and
// the published weekly window. A service-role body { check: true } pings the
// relay (non-billable Ping only) , updates site_settings.ppsr_status, and
// retries paid orders left in the outage state.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MAX_OUTAGE_RETRIES, readPpsrStatus, refreshPpsrStatus } from "../_shared/ppsr-status.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true }, 200);
  }
  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = createClient(url, service);
  const auth = req.headers.get("Authorization") || "";
  const isService = !!service && auth === "Bearer " + service;
  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
  try {
    if (isService && body && body.check === true) {
      const status = await refreshPpsrStatus(admin);
      let retried = 0;
      if (!status.down) retried = await retryOutageOrders(url, service, admin);
      return json({ ...status, retried });
    }
    const status = await readPpsrStatus(admin);
    return json(status);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Status check failed." }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function retryOutageOrders(url: string, service: string, admin: any) {
  const rows = await admin.from("vin_check_orders")
    .select("id,outage_retries")
    .eq("status", "outage")
    .lt("outage_retries", MAX_OUTAGE_RETRIES)
    .order("updated_at", { ascending: true })
    .limit(5);
  const list = rows.data || [];
  let n = 0;
  for (const row of list) {
    const res = await fetch(url + "/functions/v1/ppsr-vin-search", {
      method: "POST",
      headers: { Authorization: "Bearer " + service, "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: row.id })
    });
    if (res.ok) n++;
  }
  return n;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type"
    }
  });
}
