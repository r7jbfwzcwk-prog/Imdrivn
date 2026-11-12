// PPSR Discovery serial search (VIN) via the approved relay.
// The relay swaps __PPSR_USERNAME__ / __PPSR_PASSWORD__ for the real login.
// Required env: PPSR_RELAY_URL, RELAY_SECRET.
// Optional env: PPSR_TARGET (defaults to Discovery).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SEARCH_PATH = "/disc/2022/11/CollateralRegistrationSearch.svc/soap11";
const SOAP_ACTION = "http://schemas.ppsr.gov.au/2022/11/services/CollateralRegistrationSearch/SearchBySerialNumber";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = createClient(url, service);
  const auth = req.headers.get("Authorization") || "";
  const isService = !!service && auth === "Bearer " + service;
  const body = await req.json().catch(() => ({}));
  try {
    let orderId = String(body.orderId || "");
    if (!isService) {
      const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return json({ error: "Sign in first." }, 401);
      const profile = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
      if (!profile.data?.is_admin) return json({ error: "Not allowed." }, 403);
      const vin = cleanVin(body.vin);
      if (!vin) return json({ error: "VIN must be 17 characters and cannot include I, O, or Q." }, 400);
      const email = String(body.email || userData.user.email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Add a valid email." }, 400);
      const created = await admin.from("vin_check_orders").insert({
        vin,
        email,
        user_id: userData.user.id,
        listing_id: uuidOrNull(body.listingId),
        rego: cleanRego(body.rego),
        plate_state: cleanState(body.state),
        status: "paid"
      }).select("id").single();
      if (created.error || !created.data) return json({ error: created.error?.message || "Could not start that search." }, 500);
      orderId = created.data.id;
    }
    if (!orderId) return json({ error: "Missing order." }, 400);
    const order = await admin.from("vin_check_orders").select("id,vin,status,result,search_number").eq("id", orderId).maybeSingle();
    if (!order.data) return json({ error: "That order was not found." }, 404);
    if (order.data.status === "complete" && order.data.result) return json({ orderId, status: "complete", result: order.data.result });
    if (isService && order.data.status !== "paid" && order.data.status !== "failed" && order.data.status !== "searching") {
      return json({ error: "That order is not paid." }, 409);
    }
    await admin.from("vin_check_orders").update({ status: "searching", error: null, updated_at: new Date().toISOString() }).eq("id", orderId);
    try {
      const parsed = await searchVin(order.data.vin);
      await admin.from("vin_check_orders").update({
        status: "complete",
        result: parsed,
        search_number: parsed.searchNumber || null,
        error: null,
        updated_at: new Date().toISOString()
      }).eq("id", orderId);
      return json({ orderId, status: "complete", result: parsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The PPSR search failed.";
      await admin.from("vin_check_orders").update({
        status: "failed",
        error: message.slice(0, 800),
        updated_at: new Date().toISOString()
      }).eq("id", orderId);
      return json({ orderId, status: "failed", error: message }, 502);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Search failed." }, 500);
  }
});

async function searchVin(vin: string) {
  const base = (Deno.env.get("PPSR_RELAY_URL") || "").replace(/\/$/, "");
  const secret = Deno.env.get("RELAY_SECRET") || "";
  if (!base || !secret) throw new Error("PPSR relay is not configured.");
  const target = Deno.env.get("PPSR_TARGET") || "Discovery";
  const endpoint = base.endsWith("/soap11") ? base : base + SEARCH_PATH;
  const messageId = crypto.randomUUID();
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:svc="http://schemas.ppsr.gov.au/2022/11/services" xmlns:data="http://schemas.ppsr.gov.au/2022/11/data" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soap:Header>
    <wsse:Security soap:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>__PPSR_USERNAME__</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">__PPSR_PASSWORD__</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
    <svc:TargetEnvironment>${xml(target)}</svc:TargetEnvironment>
  </soap:Header>
  <soap:Body>
    <svc:SearchBySerialNumberRequestMessage>
      <svc:SearchBySerialNumberRequest>
        <data:CustomersRequestMessageId>${xml(messageId)}</data:CustomersRequestMessageId>
        <data:SearchCriteria>
          <data:IncludeArchived>false</data:IncludeArchived>
          <data:IncludeCurrent>true</data:IncludeCurrent>
          <data:IncludeExpired>false</data:IncludeExpired>
          <data:IncludeRemoved>false</data:IncludeRemoved>
          <data:SerialNumber>${xml(vin)}</data:SerialNumber>
          <data:SerialNumberType>VIN</data:SerialNumberType>
        </data:SearchCriteria>
      </svc:SearchBySerialNumberRequest>
    </svc:SearchBySerialNumberRequestMessage>
  </soap:Body>
</soap:Envelope>`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: '"' + SOAP_ACTION + '"',
      "X-Relay-Secret": secret
    },
    body: envelope
  });
  const xmlText = await res.text();
  const fault = tag(xmlText, "faultstring");
  if (!res.ok || fault) throw new Error(fault || "PPSR did not accept that search.");
  return parseSearch(xmlText);
}

function parseSearch(xmlText: string) {
  const summary = block(xmlText, "SearchSummary") || xmlText;
  const searchNumber = tag(summary, "SearchNumber");
  const countRaw = tag(summary, "ResultCount");
  const registrations = blocks(xmlText, "SearchResult").map((item) => {
    const party = tag(item, "OrganisationName") || [tag(item, "GivenNames"), tag(item, "FamilyName")].filter(Boolean).join(" ");
    return {
      securedParty: party,
      collateralClass: tag(item, "CollateralClassDescription") || tag(item, "CollateralClassType") || tag(item, "CollateralType"),
      start: tag(item, "RegistrationStartTime"),
      end: tag(item, "RegistrationEndTime"),
      registrationNumber: tag(item, "RegistrationNumber")
    };
  }).filter((row) => row.securedParty || row.collateralClass || row.registrationNumber || row.start);
  const nevdis = block(xmlText, "NevdisData") || block(xmlText, "VehicleDetail") || "";
  const vehicle = {
    stolen: flag(nevdis, ["Stolen", "IsStolen", "StolenIndicator", "StolenSummary"]),
    writtenOff: flag(nevdis, ["WrittenOff", "IsWrittenOff", "WrittenOffIndicator", "WrittenOffSummary"]),
    make: tag(nevdis, "Make"),
    model: tag(nevdis, "Model"),
    year: tag(nevdis, "ManufactureYear") || tag(nevdis, "YearOfManufacture") || tag(nevdis, "ComplianceYear"),
    rego: tag(nevdis, "PlateNumber") || tag(nevdis, "RegistrationPlate"),
    jurisdiction: tag(nevdis, "Jurisdiction")
  };
  const registrationCount = countRaw !== "" && Number.isFinite(Number(countRaw)) ? Number(countRaw) : registrations.length;
  return { searchNumber, registrationCount, registrations, nevdis: vehicle };
}

function flag(xmlText: string, names: string[]) {
  for (const name of names) {
    const value = tag(xmlText, name);
    if (value) return value;
  }
  return "";
}

function tag(xmlText: string, name: string) {
  const found = xmlText.match(new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([^<]*)</(?:[\\w.-]+:)?${name}>`, "i"));
  return found ? decode(found[1].trim()) : "";
}

function block(xmlText: string, name: string) {
  return blocks(xmlText, name)[0] || "";
}

function blocks(xmlText: string, name: string) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, "gi");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xmlText))) out.push(match[1]);
  return out;
}

function decode(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cleanVin(value: unknown) {
  const vin = String(value || "").trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : "";
}

function cleanRego(value: unknown) {
  const rego = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return rego || null;
}

function cleanState(value: unknown) {
  const state = String(value || "").trim().toUpperCase();
  return ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].includes(state) ? state : null;
}

function uuidOrNull(value: unknown) {
  const id = String(value || "");
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" }
  });
}
