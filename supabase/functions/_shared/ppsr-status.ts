// PPSR availability: published weekly window, site_settings.ppsr_status flag, and a
// non-billable B2G Ping through the relay. Never call SearchBySerialNumber here.

export const DOWN_WEEKLY = "PPSR is down for weekly maintenance";
export const DOWN_OUTAGE = "PPSR is down for maintenance";

const SOAP_NS = "http://schemas.ppsr.gov.au/2022/11/services";
const SEARCH_SUFFIX = "/2022/11/CollateralRegistrationSearch.svc/soap11";
const PING_ACTION = "http://schemas.ppsr.gov.au/2022/11/services/CollateralRegistrationSearchService2022/Ping";

export type PpsrMode = { prefix: string; target: string };

export type PpsrStatus = {
  state: "ok" | "down";
  down: boolean;
  reason: "weekly_maintenance" | "outage" | "manual" | null;
  message: string;
  source: "schedule" | "health" | "manual" | "ok";
  checked_at: string;
  window_end: string | null;
  health?: { ok: boolean; checked_at: string; detail: string };
};

export function modeFor(value: string): PpsrMode {
  return value.trim().toLowerCase().startsWith("disc")
    ? { prefix: "/disc", target: "Discovery" }
    : { prefix: "/prod", target: "Production" };
}

export function ppsrMode(): PpsrMode {
  return modeFor(Deno.env.get("PPSR_MODE") || "production");
}

export function scheduledWindow(now = new Date()): PpsrStatus {
  const p = canberraParts(now);
  const holiday = (p.month === 12 && p.day >= 21) || (p.month === 1 && p.day === 1);
  const inWindow = p.weekday === "Wed" && !holiday && p.minutes >= 20 * 60 + 55;
  const checked = now.toISOString();
  if (!inWindow) {
    return { state: "ok", down: false, reason: null, message: "", source: "ok", checked_at: checked, window_end: null };
  }
  return {
    state: "down",
    down: true,
    reason: "weekly_maintenance",
    message: DOWN_WEEKLY,
    source: "schedule",
    checked_at: checked,
    window_end: canberraMidnightThursday(p)
  };
}

function canberraParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const raw = Object.fromEntries(fmt.formatToParts(now).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  const hour = Number(raw.hour === "24" ? "0" : raw.hour);
  const minute = Number(raw.minute);
  const second = Number(raw.second || "0");
  return {
    weekday: String(raw.weekday),
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    hour,
    minute,
    second,
    minutes: hour * 60 + minute + second / 60
  };
}

function canberraMidnightThursday(p: { year: number; month: number; day: number }): string {
  // End of the published window is 11:59pm Wednesday Canberra time, so the
  // register is back at Thursday 00:00. Reported as an ISO instant.
  const noon = new Date(Date.UTC(p.year, p.month - 1, p.day, 2, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short" }).format(noon);
  const add = weekday === "Wed" ? 1 : weekday === "Thu" ? 0 : 1;
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + add, 14, 0, 0));
  // Walk until the Canberra date is Thursday 00:00 by binary-searching around midnight.
  const start = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  for (let ts = start; ts < start + 3 * 24 * 3600 * 1000; ts += 60 * 1000) {
    const d = new Date(ts);
    const parts = canberraParts(d);
    if (parts.weekday === "Thu" && parts.hour === 0 && parts.minute === 0 && parts.second === 0) {
      return d.toISOString();
    }
  }
  return next.toISOString();
}

export function parseFlag(value: unknown): PpsrStatus | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const state = v.state === "down" ? "down" : "ok";
  const reason = v.reason === "weekly_maintenance" || v.reason === "outage" || v.reason === "manual" ? v.reason : state === "down" ? "outage" : null;
  const source = v.source === "schedule" || v.source === "health" || v.source === "manual" || v.source === "ok" ? v.source : "ok";
  const message = String(v.message || (state === "down" ? (reason === "weekly_maintenance" ? DOWN_WEEKLY : DOWN_OUTAGE) : ""));
  const health = v.health && typeof v.health === "object" ? v.health as { ok?: boolean; checked_at?: string; detail?: string } : undefined;
  return {
    state,
    down: state === "down",
    reason,
    message,
    source,
    checked_at: String(v.checked_at || ""),
    window_end: v.window_end ? String(v.window_end) : null,
    health: health ? { ok: !!health.ok, checked_at: String(health.checked_at || ""), detail: String(health.detail || "") } : undefined
  };
}

export function mergeStatus(scheduled: PpsrStatus, flag: PpsrStatus | null, now = new Date()): PpsrStatus {
  const checked = now.toISOString();
  if (flag && flag.source === "manual" && flag.state === "down") {
    return {
      ...flag,
      down: true,
      state: "down",
      reason: "manual",
      message: flag.message || DOWN_OUTAGE,
      checked_at: checked,
      window_end: scheduled.window_end || flag.window_end
    };
  }
  if (scheduled.down) {
    return {
      ...scheduled,
      health: flag?.health,
      checked_at: checked
    };
  }
  if (flag && flag.state === "down" && (flag.source === "health" || flag.source === "manual" || flag.reason === "outage")) {
    return {
      ...flag,
      down: true,
      state: "down",
      message: flag.message || DOWN_OUTAGE,
      checked_at: checked
    };
  }
  return {
    state: "ok",
    down: false,
    reason: null,
    message: "",
    source: flag?.health ? "health" : "ok",
    checked_at: checked,
    window_end: null,
    health: flag?.health
  };
}

// deno-lint-ignore no-explicit-any
export async function readPpsrStatus(admin: any, now = new Date()): Promise<PpsrStatus> {
  const scheduled = scheduledWindow(now);
  try {
    const row = await admin.from("site_settings").select("value").eq("key", "ppsr_status").maybeSingle();
    return mergeStatus(scheduled, parseFlag(row.data?.value), now);
  } catch (_e) {
    return scheduled;
  }
}

// deno-lint-ignore no-explicit-any
export async function writePpsrStatus(admin: any, status: PpsrStatus) {
  const value = {
    state: status.state,
    reason: status.reason,
    message: status.message,
    source: status.source,
    checked_at: status.checked_at,
    window_end: status.window_end,
    health: status.health || null
  };
  await admin.from("site_settings").upsert({ key: "ppsr_status", value, updated_at: new Date().toISOString() });
}

export function isOutageError(err: unknown, httpStatus?: number) {
  if (httpStatus && (httpStatus === 502 || httpStatus === 503 || httpStatus === 504 || httpStatus === 408)) return true;
  const msg = (err instanceof Error ? err.message : String(err || "")).toLowerCase();
  if (!msg) return false;
  const hits = [
    "unavailable",
    "maintenance",
    "not available",
    "timed out",
    "timeout",
    "econnreset",
    "econnrefused",
    "enotfound",
    "network error",
    "failed to fetch",
    "temporarily",
    "suspend",
    "service unavailable",
    "bad gateway",
    "gateway timeout"
  ];
  return hits.some((k) => msg.includes(k));
}

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tag(xmlText: string, name: string) {
  const found = xmlText.match(new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([^<]*)</(?:[\\w.-]+:)?${name}>`, "i"));
  return found ? found[1].trim() : "";
}

export async function pingPpsr(mode: PpsrMode = ppsrMode(), timeoutMs = 8000): Promise<{ ok: boolean; reachable: boolean; detail: string }> {
  const rawBase = (Deno.env.get("PPSR_RELAY_URL") || "").trim();
  const secret = Deno.env.get("RELAY_SECRET") || "";
  if (!rawBase || !secret) return { ok: false, reachable: false, detail: "PPSR relay is not configured." };
  let origin = "";
  try { origin = new URL(rawBase).origin; } catch { return { ok: false, reachable: false, detail: "PPSR relay URL is not valid." }; }
  const endpoint = origin + mode.prefix + SEARCH_SUFFIX;
  const created = new Date().toISOString();
  const envelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header><TargetEnvironment xmlns="${SOAP_NS}">${xml(mode.target)}</TargetEnvironment><wsse:Security s:mustUnderstand="1" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><wsse:UsernameToken wsu:Id="UsernameToken-1"><wsse:Username>{{PPSR_USERNAME}}</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{{PPSR_PASSWORD}}</wsse:Password><wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security></s:Header><s:Body><Ping xmlns="${SOAP_NS}"/></s:Body></s:Envelope>`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '"' + PING_ACTION + '"',
        Authorization: "Bearer " + secret
      },
      body: envelope,
      signal: ac.signal
    });
    const text = await res.text();
    const fault = tag(text, "faultstring") || tag(text, "FaultString");
    if (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 408) {
      return { ok: false, reachable: false, detail: fault || ("Relay or PPSR returned " + res.status + ".") };
    }
    if (isOutageError(fault, res.status) || isOutageError(text.slice(0, 400), res.status)) {
      return { ok: false, reachable: false, detail: fault || ("PPSR unavailable (" + res.status + ").") };
    }
    // A SOAP or HTTP error that is not an outage still means the register answered, so it is not down.
    if (res.ok && !fault) return { ok: true, reachable: true, detail: "Ping ok." };
    if (res.status === 401 || res.status === 403) return { ok: true, reachable: true, detail: "Relay reachable (auth error, not treated as a PPSR outage)." };
    return { ok: true, reachable: true, detail: fault ? ("PPSR reachable: " + fault.slice(0, 200)) : ("PPSR reachable (" + res.status + ").") };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ping failed.";
    if (/abort/i.test(message)) return { ok: false, reachable: false, detail: "PPSR ping timed out." };
    return { ok: false, reachable: false, detail: message.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

// deno-lint-ignore no-explicit-any
export async function refreshPpsrStatus(admin: any, now = new Date()): Promise<PpsrStatus> {
  const scheduled = scheduledWindow(now);
  const existing = await readPpsrStatus(admin, now);
  if (existing.source === "manual" && existing.state === "down") {
    const kept = { ...existing, checked_at: now.toISOString(), health: existing.health };
    await writePpsrStatus(admin, kept);
    return kept;
  }
  if (scheduled.down) {
    const next: PpsrStatus = {
      ...scheduled,
      health: existing.health,
      checked_at: now.toISOString()
    };
    await writePpsrStatus(admin, next);
    return next;
  }
  const ping = await pingPpsr();
  const next: PpsrStatus = ping.ok
    ? {
        state: "ok",
        down: false,
        reason: null,
        message: "",
        source: "health",
        checked_at: now.toISOString(),
        window_end: null,
        health: { ok: true, checked_at: now.toISOString(), detail: ping.detail }
      }
    : {
        state: "down",
        down: true,
        reason: "outage",
        message: DOWN_OUTAGE,
        source: "health",
        checked_at: now.toISOString(),
        window_end: null,
        health: { ok: false, checked_at: now.toISOString(), detail: ping.detail }
      };
  await writePpsrStatus(admin, next);
  return next;
}

export const OUTAGE_MESSAGE = "PPSR was down, so this search was not completed. We will retry when the register is back, or refund the $10 if we cannot complete it.";
export const MAX_OUTAGE_RETRIES = 8;
