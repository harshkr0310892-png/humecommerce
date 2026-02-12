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

function base64Url(bytes: Uint8Array) {
  const bin = String.fromCharCode(...bytes);
  const b64 = btoa(bin);
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomDigits(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) out += (bytes[i] % 10).toString();
  return out;
}

function randomInt(maxExclusive: number) {
  if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) throw new Error("Invalid maxExclusive");
  const max = Math.floor(maxExclusive);
  const range = 0x1_0000_0000;
  const limit = range - (range % max);
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    const x = buf[0]!;
    if (x < limit) return x % max;
  }
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomAdminOtp(tokenLength: number) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.?/|~";
  const emojis = ["🔒", "🛡", "🔥", "✅", "🎯", "⚡", "🚀", "💎", "🌟", "🧩", "🧠", "🧱", "🪙", "🎉", "🕶"];

  const groups: Array<{ kind: string; pool: string[] }> = [
    { kind: "upper", pool: upper.split("") },
    { kind: "lower", pool: lower.split("") },
    { kind: "digit", pool: digits.split("") },
    { kind: "symbol", pool: symbols.split("") },
    { kind: "emoji", pool: emojis.slice() },
  ];

  if (!Number.isFinite(tokenLength) || tokenLength < groups.length) {
    throw new Error("Invalid tokenLength");
  }

  const tokens: string[] = [];
  for (const g of groups) tokens.push(g.pool[randomInt(g.pool.length)]!);

  const allPools = groups.flatMap((g) => g.pool);
  while (tokens.length < tokenLength) tokens.push(allPools[randomInt(allPools.length)]!);

  shuffleInPlace(tokens);
  return tokens.join("");
}

function otpEmailHtml(opts: { appName: string; otp: string; minutes: number; logoUrl?: string | null }) {
  const { appName, otp, minutes, logoUrl } = opts;
  const safeLogo = logoUrl ? String(logoUrl) : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${appName} Admin Login</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border:1px solid #e7e9f2;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
        <div style="padding:22px 22px 18px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${safeLogo ? `<img src="${safeLogo}" alt="" width="34" height="34" style="border-radius:8px;display:block;object-fit:cover;" />` : ""}
            <div style="font-size:18px;font-weight:700;letter-spacing:0.2px;">${appName}</div>
          </div>
          <div style="margin-top:8px;font-size:14px;opacity:0.9;">Admin login verification code</div>
        </div>
        <div style="padding:22px;">
          <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#0f172a;">
            Use the OTP below to complete admin login. This code expires in <b>${minutes} minutes</b>.
          </p>
          <div style="margin:18px 0 10px;padding:18px;border:1px dashed #c7cbe2;border-radius:12px;background:#f8fafc;text-align:center;">
            <div style="font-size:22px;font-weight:800;letter-spacing:0;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;word-break:break-all;line-height:1.4;">${otp}</div>
          </div>
          <div style="text-align:center;margin:12px 0 0;">
            <a
              href="#"
              onclick='(function(){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(${JSON.stringify(otp)});}}catch(e){}})();return false;'
              style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;"
            >
              Copy OTP
            </a>
          </div>
          <p style="margin:10px 0 0;font-size:12px;line-height:1.55;color:#475569;text-align:center;">
            If the button doesn’t work, select the OTP text and copy.
          </p>
          <p style="margin:12px 0 0;font-size:12px;line-height:1.55;color:#475569;">
            If you didn’t request this, you can ignore this email.
          </p>
        </div>
      </div>
      <div style="text-align:center;margin-top:12px;font-size:11px;color:#94a3b8;">
        © ${new Date().getFullYear()} ${appName}
      </div>
    </div>
  </body>
</html>`;
}

function postgrestBaseHeaders(serviceRoleKey: string) {
  return {
    authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "content-type": "application/json",
  };
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
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

    const APP_NAME = Deno.env.get("APP_NAME") ?? "Ecommerce";
    const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "no-reply@example.com";
    const OTP_PEPPER = Deno.env.get("OTP_PEPPER") ?? "";

    const ADMIN_OTP_EMAIL = (Deno.env.get("ADMIN_OTP_EMAIL") ?? "").toLowerCase().trim();
    const ADMIN_OTP_LOGO_URL = Deno.env.get("ADMIN_OTP_LOGO_URL") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing Supabase service role configuration" }, { status: 500 });
    }
    if (!ADMIN_OTP_EMAIL) {
      return json({ error: "Missing ADMIN_OTP_EMAIL" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const action = body?.action as string | undefined;

    if (!action) return json({ error: "Missing action" }, { status: 400 });

    const requestEmail = (body?.email ?? ADMIN_OTP_EMAIL).toString().trim().toLowerCase();
    if (requestEmail !== ADMIN_OTP_EMAIL) {
      return json({ error: "Invalid admin email" }, { status: 400 });
    }

    const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
    const ip = forwardedFor.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    if (action === "request") {
      const last = (await pgSelectOne({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "admin_login_otps",
        select: "id,created_at,expires_at,consumed_at",
        filters: { email: `eq.${ADMIN_OTP_EMAIL}`, consumed_at: "is.null" },
        order: "created_at.desc",
      })) as { created_at?: string } | null;

      if (last?.created_at) {
        const ageMs = Date.now() - new Date(last.created_at).getTime();
        if (ageMs < 10_000) {
          return json({ ok: true });
        }
      }

      const otp = randomAdminOtp(15);
      const otpSalt = base64Url(crypto.getRandomValues(new Uint8Array(16)));
      const otpHash = await sha256Hex(`${otp}:${otpSalt}:${OTP_PEPPER}`);

      const expiresAt = new Date(Date.now() + 1 * 60 * 1000).toISOString();

      await pgPatch({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "admin_login_otps",
        filters: { email: `eq.${ADMIN_OTP_EMAIL}`, consumed_at: "is.null" },
        body: { consumed_at: new Date().toISOString() },
      });

      const okInsert = await pgInsert({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "admin_login_otps",
        body: {
          email: ADMIN_OTP_EMAIL,
          otp_hash: otpHash,
          otp_salt: otpSalt,
          expires_at: expiresAt,
          requester_ip: ip,
          requester_user_agent: userAgent,
        },
      });
      if (!okInsert) return json({ error: "Failed to create OTP" }, { status: 500 });

      if (!RESEND_API_KEY) return json({ ok: true });

      const html = otpEmailHtml({ appName: APP_NAME, otp, minutes: 1, logoUrl: ADMIN_OTP_LOGO_URL || null });

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [ADMIN_OTP_EMAIL],
          subject: `${APP_NAME} admin login OTP`,
          html,
        }),
      });

      if (!sendRes.ok) return json({ error: "Failed to send email" }, { status: 500 });

      return json({ ok: true });
    }

    if (action === "verify") {
      const otp = (body?.otp ?? "").toString().trim();
      if (otp.length < 10 || otp.length > 128) return json({ error: "Invalid OTP" }, { status: 400 });

      const row = (await pgSelectOne({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "admin_login_otps",
        select: "id,otp_hash,otp_salt,attempts,expires_at,consumed_at,created_at",
        filters: {
          email: `eq.${ADMIN_OTP_EMAIL}`,
          consumed_at: "is.null",
          expires_at: `gt.${new Date().toISOString()}`,
        },
        order: "created_at.desc",
      })) as { id: string; otp_hash: string; otp_salt: string; attempts?: number | null } | null;

      if (!row) return json({ error: "OTP expired" }, { status: 400 });

      const expected = row.otp_hash;
      const actual = await sha256Hex(`${otp}:${row.otp_salt}:${OTP_PEPPER}`);

      if (expected !== actual) {
        const nextAttempts = (row.attempts ?? 0) + 1;
        await pgPatch({
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
          table: "admin_login_otps",
          filters: { id: `eq.${row.id}` },
          body: {
            attempts: nextAttempts,
            consumed_at: nextAttempts >= 5 ? new Date().toISOString() : null,
          },
        });

        return json({ error: "Invalid OTP" }, { status: 400 });
      }

      const okVerify = await pgPatch({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "admin_login_otps",
        filters: { id: `eq.${row.id}` },
        body: {
          verified_at: new Date().toISOString(),
          consumed_at: new Date().toISOString(),
        },
      });

      if (!okVerify) return json({ error: "Failed to verify OTP" }, { status: 500 });

      return json({ ok: true });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, { status: 500 });
  }
});
