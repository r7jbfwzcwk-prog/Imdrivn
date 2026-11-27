// PPSR serial search (VIN) via the approved relay (Production by default since 27 Nov 2026).
// The relay swaps {{PPSR_USERNAME}} / {{PPSR_PASSWORD}} for the real login.
// Required env: PPSR_RELAY_URL (relay origin, any path is ignored), RELAY_SECRET.
// Optional env: PPSR_MODE = "production" (default) or "discovery" (rollback / testing).
// After a successful search the official PPSR search certificate PDF is requested (no fee) and
// emailed with public.send_vin_certificate_email (customer + IM DRIVN admin inbox).
// The certificate step runs in the background (EdgeRuntime.waitUntil) so the report and Stripe webhook return fast.
// Body extras: { waitCertificate: true } waits for it. Service role only: { mode: "discovery" } for tests,
// { certificateOnly: true } to retry the certificate on a complete order (no new search, no fee).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SEARCH_SUFFIX = "/2022/11/CollateralRegistrationSearch.svc/soap11";
const SOAP_ACTION = "http://schemas.ppsr.gov.au/2022/11/services/CollateralRegistrationSearchService2022/SearchBySerialNumber";

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
      const email = String(userData.user.email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Your account needs an email so we can send the official PPSR certificate." }, 400);
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
    const order = await admin.from("vin_check_orders").select("id,vin,status,result,search_number,report_sent_at").eq("id", orderId).maybeSingle();
    if (!order.data) return json({ error: "That order was not found." }, 404);
    const certOnly = isService && body.certificateOnly === true;
    const forceMode = isService && typeof body.mode === "string" ? String(body.mode) : "";
    if (order.data.status === "complete" && order.data.result) {
      if (!certOnly) return json({ orderId, status: "complete", result: order.data.result });
      const prev = order.data.result as Record<string, unknown>;
      const cert = await certificateStep(admin, orderId, String(prev.searchNumber || order.data.search_number || ""), modeFor(String(prev.environment || forceMode)), prev);
      return json({ orderId, status: "complete", certificate: cert });
    }
    if (isService && order.data.status !== "paid" && order.data.status !== "failed" && order.data.status !== "searching") {
      return json({ error: "That order is not paid." }, 409);
    }
    await admin.from("vin_check_orders").update({ status: "searching", error: null, updated_at: new Date().toISOString() }).eq("id", orderId);
    try {
      const mode = forceMode ? modeFor(forceMode) : ppsrMode();
      const parsed = await searchVin(order.data.vin, mode);
      await admin.from("vin_check_orders").update({
        status: "complete",
        result: parsed,
        search_number: parsed.searchNumber || null,
        error: null,
        updated_at: new Date().toISOString()
      }).eq("id", orderId);
      let cert: unknown = { status: "skipped" };
      // deno-lint-ignore no-explicit-any
      const rt = (globalThis as any).EdgeRuntime;
      const parsedRec = parsed as unknown as Record<string, unknown>;
      const alertJob = stolenAlert(admin, orderId, parsedRec);
      if (parsed.searchNumber) {
        const job = certificateStep(admin, orderId, parsed.searchNumber, mode, parsedRec);
        if (body.waitCertificate !== true && rt && typeof rt.waitUntil === "function") {
          rt.waitUntil(Promise.all([job.catch(() => null), alertJob.catch(() => null)]));
          cert = { status: "queued" };
        } else {
          cert = await job;
          await alertJob.catch(() => null);
        }
      } else if (body.waitCertificate !== true && rt && typeof rt.waitUntil === "function") {
        rt.waitUntil(alertJob.catch(() => null));
      } else {
        await alertJob.catch(() => null);
      }
      return json({ orderId, status: "complete", result: parsed, certificate: cert });
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

type Mode = { prefix: string; target: string };

function modeFor(value: string): Mode {
  return value.trim().toLowerCase().startsWith("disc") ? { prefix: "/disc", target: "Discovery" } : { prefix: "/prod", target: "Production" };
}

function ppsrMode(): Mode {
  return modeFor(Deno.env.get("PPSR_MODE") || "production");
}

function relayEndpoint(mode: Mode) {
  const rawBase = (Deno.env.get("PPSR_RELAY_URL") || "").trim();
  const secret = Deno.env.get("RELAY_SECRET") || "";
  if (!rawBase || !secret) throw new Error("PPSR relay is not configured.");
  let origin = "";
  try { origin = new URL(rawBase).origin; } catch { throw new Error("PPSR relay URL is not valid."); }
  return { endpoint: origin + mode.prefix + SEARCH_SUFFIX, secret };
}

async function searchVin(vin: string, mode: Mode) {
  const { endpoint, secret } = relayEndpoint(mode);
  const target = mode.target;
  const messageId = crypto.randomUUID();
  const created = new Date().toISOString();
  const envelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header><TargetEnvironment xmlns="http://schemas.ppsr.gov.au/2022/11/services">${xml(target)}</TargetEnvironment><wsse:Security s:mustUnderstand="1" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><wsse:UsernameToken wsu:Id="UsernameToken-1"><wsse:Username>{{PPSR_USERNAME}}</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{{PPSR_PASSWORD}}</wsse:Password><wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security></s:Header><s:Body><SearchBySerialNumberRequestMessage xmlns="http://schemas.ppsr.gov.au/2022/11/services"><SearchBySerialNumberRequest xmlns:d="http://schemas.ppsr.gov.au/2016/05/data" xmlns:a="http://schemas.ppsr.gov.au/2011/04/data" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><d:CustomersRequestMessageId>${xml(messageId)}</d:CustomersRequestMessageId><d:CustomersUserDefinedFields i:nil="true"/><d:SearchCriteria><a:IncludeArchived>false</a:IncludeArchived><a:IncludeCurrent>true</a:IncludeCurrent><a:IncludeExpired>false</a:IncludeExpired><a:IncludeRemoved>false</a:IncludeRemoved><a:SerialNumber>${xml(vin)}</a:SerialNumber><a:SerialNumberType>VIN</a:SerialNumberType></d:SearchCriteria></SearchBySerialNumberRequest></SearchBySerialNumberRequestMessage></s:Body></s:Envelope>`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: '"' + SOAP_ACTION + '"',
      Authorization: "Bearer " + secret
    },
    body: envelope
  });
  const xmlText = await res.text();
  const fault = tag(xmlText, "faultstring");
  if (!res.ok || fault) throw new Error(fault || "PPSR did not accept that search.");
  return parseSearch(xmlText, target);
}

const SOAP_NS = "http://schemas.ppsr.gov.au/2022/11/services";
const ACTION_BASE = "http://schemas.ppsr.gov.au/2022/11/services/CollateralRegistrationSearchService2022/";

function envelope(target: string, inner: string) {
  const created = new Date().toISOString();
  return `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header><TargetEnvironment xmlns="${SOAP_NS}">${xml(target)}</TargetEnvironment><wsse:Security s:mustUnderstand="1" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><wsse:UsernameToken wsu:Id="UsernameToken-1"><wsse:Username>{{PPSR_USERNAME}}</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{{PPSR_PASSWORD}}</wsse:Password><wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security></s:Header><s:Body>${inner}</s:Body></s:Envelope>`;
}

async function callPpsr(mode: Mode, operation: string, inner: string) {
  const { endpoint, secret } = relayEndpoint(mode);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '"' + ACTION_BASE + operation + '"', Authorization: "Bearer " + secret },
    body: envelope(mode.target, inner)
  });
  const text = await res.text();
  const fault = tag(text, "faultstring");
  if (!res.ok || fault) throw new Error(fault || ("PPSR " + operation + " failed (" + res.status + ")."));
  return text;
}

function commonFields(prefix: string) {
  return `<d:CustomersRequestMessageId>${xml(prefix + "-" + crypto.randomUUID())}</d:CustomersRequestMessageId><d:CustomersUserDefinedFields i:nil="true"/>`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Requests the official search certificate for the whole serial number search (free with the search),
// polls RetrieveSearchCertificate, then emails ONLY the certificate PDF to the customer and the IM DRIVN inbox.
async function certificateStep(admin: ReturnType<typeof createClient>, orderId: string, searchNumber: string, mode: Mode, result: Record<string, unknown>) {
  const prior = (result.certificate || {}) as Record<string, unknown>;
  const save = async (cert: Record<string, unknown>) => {
    const merged = { ...result, certificate: cert };
    await admin.from("vin_check_orders").update({ result: merged, updated_at: new Date().toISOString() }).eq("id", orderId);
    return cert;
  };
  if (!searchNumber) return save({ status: "failed", error: "No search number." });
  let number = String(prior.number || "");
  let expiry = String(prior.accessExpiry || "");
  try {
    if (!number) {
      const req = await callPpsr(mode, "RequestSearchCertificate",
        `<RequestSearchCertificateRequestMessage xmlns="${SOAP_NS}"><RequestSearchCertificateRequest xmlns:d="http://schemas.ppsr.gov.au/2016/05/data" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${commonFields("imd-rc")}<d:SearchNumber>${xml(searchNumber)}</d:SearchNumber></RequestSearchCertificateRequest></RequestSearchCertificateRequestMessage>`);
      number = tag(req, "SearchCertificateNumber");
      expiry = tag(req, "AccessToSearchCertificateExpiryTime");
      if (!number) throw new Error("PPSR did not return a certificate number.");
      await save({ status: "requested", number, accessExpiry: expiry, requestedTransactionId: tag(req, "PpsrTransactionId") });
    }
    let file = "";
    let fileName = "";
    for (const wait of [1000, 3000, 5000, 10000, 10000, 15000]) {
      await sleep(wait);
      const got = await callPpsr(mode, "RetrieveSearchCertificate",
        `<RetrieveSearchCertificateRequestMessage xmlns="${SOAP_NS}"><RetrieveSearchCertificateRequest xmlns:d="http://schemas.ppsr.gov.au/2016/05/data" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${commonFields("imd-gc")}<d:SearchCertificateNumber>${xml(number)}</d:SearchCertificateNumber></RetrieveSearchCertificateRequest></RetrieveSearchCertificateRequestMessage>`);
      const m = got.match(/<(?:[\w.-]+:)?SearchCertificateFile\b[^>]*>([^<]+)</);
      if (m && m[1].trim()) {
        file = m[1].replace(/\s+/g, "");
        fileName = tag(got, "SearchCertificateFileName") || ("PPSR Search Certificate " + number + ".pdf");
        expiry = tag(got, "AccessToSearchCertificateExpiryTime") || expiry;
        break;
      }
    }
    if (!file) return save({ status: "pending", number, accessExpiry: expiry, error: "Certificate not ready yet. Retry with certificateOnly." });
    let storagePath = String(prior.storagePath || "");
    try {
      const safeName = (fileName || ("PPSR Search Certificate " + number + ".pdf")).replace(/[^\w.\- ]+/g, "_");
      const path = orderId + "/" + safeName;
      const bin = atob(file);
      const raw = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
      const up = await admin.storage.from("vin-certificates").upload(path, raw, { contentType: "application/pdf", upsert: true });
      if (!up.error) storagePath = path;
    } catch (_e) {
      // Email still goes out even if the on-site copy could not be stored.
    }
    const sent = await admin.rpc("send_vin_certificate_email", { p_order_id: orderId, p_pdf_base64: file, p_filename: fileName, p_certificate_number: number });
    if (sent.error) return save({ status: "email_failed", number, fileName, storagePath: storagePath || null, accessExpiry: expiry, error: sent.error.message });
    return save({ status: "emailed", number, fileName, storagePath: storagePath || null, accessExpiry: expiry, emailedAt: new Date().toISOString() });
  } catch (err) {
    return save({ status: "failed", number: number || null, accessExpiry: expiry || null, error: (err instanceof Error ? err.message : "Certificate failed.").slice(0, 400) });
  }
}


function isStolenResult(result: Record<string, unknown> | null | undefined) {
  const nev = (result && result.nevdis || {}) as Record<string, unknown>;
  const records = Array.isArray(nev.stolenRecords) ? nev.stolenRecords : [];
  if (records.length) return true;
  const text = String(nev.stolen || "").trim().toLowerCase();
  if (!text || text === "no record" || text === "not stated" || text === "-" || text.startsWith("not verified")) return false;
  return true;
}

async function stolenAlert(admin: ReturnType<typeof createClient>, orderId: string, result: Record<string, unknown>) {
  if (!isStolenResult(result)) return null;
  const sent = await admin.rpc("record_vin_stolen_alert", { p_order_id: orderId });
  if (sent.error) console.error("vin stolen alert failed", sent.error.message);
  return sent.data || null;
}

function parseSearch(xmlText: string, environment: string) {
  const summary = block(xmlText, "SearchSummary") || xmlText;
  const searchNumber = tag(summary, "SearchNumber");
  const countRaw = tag(summary, "ResultCount");
  const registrations = blocks(xmlText, "ResultDetail").map((item) => {
    const party = tag(item, "OrganisationName") || [tag(item, "GivenNames"), tag(item, "FamilyName")].filter(Boolean).join(" ");
    return {
      securedParty: party,
      collateralClass: tag(item, "CollateralClassDescription") || tag(item, "CollateralClassType") || tag(item, "CollateralType"),
      start: tag(item, "RegistrationStartTime"),
      end: tag(item, "RegistrationEndTime"),
      registrationNumber: tag(item, "RegistrationNumber")
    };
  }).filter((row) => row.securedParty || row.collateralClass || row.registrationNumber || row.start);
  const nevdisBlock = block(xmlText, "NevdisData");
  const verificationStatus = tag(nevdisBlock, "VerificationStatus");
  const vehicleBlock = block(nevdisBlock, "NevdisVehicle") || nevdisBlock;
  const found = verificationStatus.toLowerCase() === "found";
  const stolenList = allTags(vehicleBlock, "StolenSummary");
  const writtenOffList = allTags(vehicleBlock, "WrittenOffSummary");
  const statusText = (list: string[]) => list.length ? list.join("; ") : found ? "No record" : verificationStatus ? "Not verified (" + verificationStatus + ")" : "";
  const vehicle = {
    verificationStatus,
    stolen: statusText(stolenList),
    stolenRecords: stolenList,
    writtenOff: statusText(writtenOffList),
    writtenOffRecords: writtenOffList,
    make: tag(vehicleBlock, "Make"),
    model: tag(vehicleBlock, "Model"),
    year: tag(vehicleBlock, "ManufactureYear") || tag(vehicleBlock, "ComplianceYearMonth"),
    colour: tag(vehicleBlock, "Colour"),
    bodyType: tag(vehicleBlock, "BodyType"),
    vehicleType: tag(vehicleBlock, "VehicleType"),
    compliance: tag(vehicleBlock, "ComplianceYearMonth"),
    engineNumber: tag(vehicleBlock, "EngineNumber"),
    rego: tag(vehicleBlock, "PlateNumber"),
    regoExpiry: tag(vehicleBlock, "ExpiryDate"),
    jurisdiction: tag(vehicleBlock, "Jurisdiction")
  };
  const registrationCount = countRaw !== "" && Number.isFinite(Number(countRaw)) ? Number(countRaw) : registrations.length;
  return {
    searchNumber,
    registrationCount,
    registrations,
    nevdis: vehicle,
    environment: tag(xmlText, "RequestProcessedByEnvironment") || environment,
    transactionId: tag(xmlText, "PpsrTransactionId"),
    searchedAt: tag(summary, "SearchExecutedDateTime"),
    messages: allTags(block(xmlText, "PpsrResponseMessages"), "string")
  };
}

function allTags(xmlText: string, name: string) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([^<]*)</(?:[\\w.-]+:)?${name}>`, "gi");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xmlText))) { const v = decode(match[1].trim()); if (v) out.push(v); }
  return out;
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
