export {};

type DenoLike = {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const Deno = (globalThis as unknown as { Deno: DenoLike }).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomDigits(len: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += (bytes[i] % 10).toString();
  return out;
}

function base64UrlToBytes(b64url: string) {
  const base64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseJwtUserId(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payloadBytes = base64UrlToBytes(parts[1] ?? "");
    const payloadText = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadText) as { role?: unknown; sub?: unknown };
    if (payload.role !== "authenticated") return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function normalizeIndianToE164(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-()\u202c]/g, "");
  if (/[^0-9+]/.test(cleaned) || (cleaned.includes("+") && !cleaned.startsWith("+"))) return null;
  let digits = cleaned;
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length !== 10) return null;
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

function postgrestBaseHeaders(serviceRoleKey: string) {
  return {
    authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "content-type": "application/json",
  };
}

async function pgSelectOne(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  table: string;
  select: string;
  filters: Record<string, string>;
  order?: string;
}) {
  const { supabaseUrl, serviceRoleKey, table, select, filters, order } = params;
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  for (const [k, v] of Object.entries(filters)) url.searchParams.set(k, v);
  if (order) url.searchParams.set("order", order);
  url.searchParams.set("limit", "1");
  const res = await fetch(url.toString(), {
    headers: {
      ...postgrestBaseHeaders(serviceRoleKey),
      accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as any;
}

async function pgInsert(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  table: string;
  body: Record<string, unknown>;
}) {
  const { supabaseUrl, serviceRoleKey, table, body } = params;
  const url = `${supabaseUrl}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...postgrestBaseHeaders(serviceRoleKey),
      prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function pgPatch(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  table: string;
  filters: Record<string, string>;
  body: Record<string, unknown>;
}) {
  const { supabaseUrl, serviceRoleKey, table, filters, body } = params;
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(filters)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      ...postgrestBaseHeaders(serviceRoleKey),
      prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function sendTwilioSms(params: { accountSid: string; authToken: string; from: string; to: string; body: string }) {
  const { accountSid, authToken, from, to, body } = params;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const auth = btoa(`${accountSid}:${authToken}`);
  const form = new URLSearchParams();
  form.set("From", from);
  form.set("To", to);
  form.set("Body", body);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const OTP_PEPPER = Deno.env.get("OTP_PEPPER") ?? "";

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
    const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";

    const APP_NAME = Deno.env.get("APP_NAME") ?? "Ecommerce";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing Supabase service role configuration" }, { status: 500 });
    }
    if (!OTP_PEPPER) return json({ error: "Missing OTP_PEPPER" }, { status: 500 });
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      return json({ error: "Missing Twilio configuration" }, { status: 500 });
    }

    const userId = parseJwtUserId(req);
    if (!userId) return json({ error: "Unauthorized" }, { status: 401 });

    const payload = await req.json().catch(() => null);
    const action = (payload?.action ?? "").toString();
    const phoneInput = (payload?.phone ?? "").toString();
    const phoneE164 = normalizeIndianToE164(phoneInput);

    if (!action) return json({ error: "Missing action" }, { status: 400 });
    if (!phoneE164) return json({ error: "Invalid phone. Only +91 Indian mobile numbers allowed." }, { status: 400 });

    const nowIso = new Date().toISOString();
    const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
    const requesterIp = forwardedFor.split(",")[0]?.trim() || null;
    const requesterUserAgent = (req.headers.get("user-agent") ?? "").slice(0, 500) || null;

    if (action === "request" || action === "resend") {
      const existing = await pgSelectOne({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "phone_verification_otps",
        select: "id,created_at,expires_at,consumed_at",
        filters: {
          user_id: `eq.${userId}`,
          phone_e164: `eq.${phoneE164}`,
          consumed_at: "is.null",
        },
        order: "created_at.desc",
      });

      if (existing?.created_at) {
        const createdAtMs = Date.parse(String(existing.created_at));
        if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 30_000) {
          return json({ error: "Please wait before requesting another OTP." }, { status: 429 });
        }
      }

      const otp = randomDigits(6);
      const salt = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
      const otpHash = await sha256Hex(`${otp}:${salt}:${OTP_PEPPER}`);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const okInsert = await pgInsert({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "phone_verification_otps",
        body: {
          user_id: userId,
          phone_e164: phoneE164,
          otp_hash: otpHash,
          otp_salt: salt,
          attempts: 0,
          expires_at: expiresAt,
          requester_ip: requesterIp,
          requester_user_agent: requesterUserAgent,
        },
      });
      if (!okInsert) return json({ error: "Failed to create OTP" }, { status: 500 });

      const profile = await pgSelectOne({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "customer_profiles",
        select: "id,user_id",
        filters: { user_id: `eq.${userId}` },
      });

      if (profile?.id) {
        await pgPatch({
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
          table: "customer_profiles",
          filters: { user_id: `eq.${userId}` },
          body: { phone: phoneE164 },
        });
      } else {
        await pgInsert({
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
          table: "customer_profiles",
          body: { user_id: userId, full_name: null, phone: phoneE164, address: null, avatar_url: null },
        });
      }

      const smsBody = `${APP_NAME} OTP: ${otp}. Valid for 10 minutes. Do not share this code.`;
      const okSms = await sendTwilioSms({
        accountSid: TWILIO_ACCOUNT_SID,
        authToken: TWILIO_AUTH_TOKEN,
        from: TWILIO_FROM_NUMBER,
        to: phoneE164,
        body: smsBody,
      });
      if (!okSms) return json({ error: "Failed to send OTP SMS" }, { status: 502 });

      return json({ ok: true, expires_at: expiresAt });
    }

    if (action === "verify") {
      const otp = (payload?.otp ?? "").toString().trim();
      if (!/^\d{6}$/.test(otp)) return json({ error: "Invalid OTP" }, { status: 400 });

      const row = await pgSelectOne({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "phone_verification_otps",
        select: "id,otp_hash,otp_salt,attempts,expires_at,consumed_at",
        filters: {
          user_id: `eq.${userId}`,
          phone_e164: `eq.${phoneE164}`,
          consumed_at: "is.null",
          expires_at: `gt.${nowIso}`,
        },
        order: "created_at.desc",
      });

      if (!row?.id) return json({ error: "OTP expired. Please request again." }, { status: 400 });

      const attempts = Number(row.attempts ?? 0);
      if (!Number.isFinite(attempts) || attempts >= 5) {
        return json({ error: "Too many attempts. Please request a new OTP." }, { status: 429 });
      }

      const expected = String(row.otp_hash ?? "");
      const salt = String(row.otp_salt ?? "");
      const actual = await sha256Hex(`${otp}:${salt}:${OTP_PEPPER}`);

      if (!expected || expected !== actual) {
        await pgPatch({
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
          table: "phone_verification_otps",
          filters: { id: `eq.${row.id}` },
          body: { attempts: attempts + 1 },
        });
        return json({ error: "Invalid OTP" }, { status: 400 });
      }

      const okConsume = await pgPatch({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "phone_verification_otps",
        filters: { id: `eq.${row.id}` },
        body: { verified_at: nowIso, consumed_at: nowIso },
      });
      if (!okConsume) return json({ error: "Failed to verify OTP" }, { status: 500 });

      const okProfile = await pgPatch({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "customer_profiles",
        filters: { user_id: `eq.${userId}` },
        body: { phone: phoneE164, phone_verified_at: nowIso },
      });
      if (!okProfile) return json({ error: "Failed to update profile" }, { status: 500 });

      return json({ ok: true });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return json({ error: msg }, { status: 500 });
  }
});
