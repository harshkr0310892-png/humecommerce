export {};

const Deno = (globalThis as any).Deno;

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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function otpEmailHtml(opts: { appName: string; otp: string; minutes: number }) {
  const { appName, otp, minutes } = opts;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${appName} Password Reset</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border:1px solid #e7e9f2;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
        <div style="padding:22px 22px 18px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;">
          <div style="font-size:18px;font-weight:700;letter-spacing:0.2px;">${appName}</div>
          <div style="margin-top:6px;font-size:14px;opacity:0.9;">Password reset verification code</div>
        </div>
        <div style="padding:22px;">
          <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#0f172a;">
            Use the OTP below to reset your password. This code expires in <b>${minutes} minutes</b>.
          </p>
          <div style="margin:18px 0 10px;padding:18px;border:1px dashed #c7cbe2;border-radius:12px;background:#f8fafc;text-align:center;">
            <div style="font-size:28px;font-weight:800;letter-spacing:6px;color:#0f172a;">${otp}</div>
          </div>
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

async function authUserByEmail(params: { supabaseUrl: string; serviceRoleKey: string; email: string }) {
  const { supabaseUrl, serviceRoleKey, email } = params;

  const perPage = 1000;
  for (let page = 1; page <= 10; page++) {
    const url = new URL(`${supabaseUrl}/auth/v1/admin/users`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    const res = await fetch(url.toString(), {
      headers: {
        authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "content-type": "application/json",
      },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const users = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
    for (const u of users) {
      if (typeof u?.email === "string" && u.email.toLowerCase() === email) {
        return u as { id: string; email: string };
      }
    }

    if (!Array.isArray(users) || users.length < perPage) break;
  }

  return null;
}

async function updatePassword(params: { supabaseUrl: string; serviceRoleKey: string; userId: string; password: string }) {
  const { supabaseUrl, serviceRoleKey, userId, password } = params;
  const url = `${supabaseUrl}/auth/v1/admin/users/${userId}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

function postgrestBaseHeaders(serviceRoleKey: string) {
  return {
    authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "content-type": "application/json",
  };
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
  return data[0] as any;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

    const APP_NAME = Deno.env.get("APP_NAME") ?? "Ecommerce";
    const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "no-reply@example.com";
    const OTP_PEPPER = Deno.env.get("OTP_PEPPER") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing Supabase service role configuration" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const action = body?.action as string | undefined;

    if (!action) return json({ error: "Missing action" }, { status: 400 });

    if (action === "request") {
      const email = (body?.email ?? "").toString().trim().toLowerCase();
      if (!isValidEmail(email)) return json({ error: "Invalid email" }, { status: 200 });

      const user = await authUserByEmail({ supabaseUrl: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY, email });

      if (!user) {
        return json({ error: "You didn't create any account from this email" }, { status: 200 });
      }

      const otp = randomDigits(6);
      const otpSalt = base64Url(crypto.getRandomValues(new Uint8Array(16)));
      const otpHash = await sha256Hex(`${otp}:${otpSalt}:${OTP_PEPPER}`);

      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await pgPatch({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "password_reset_otps",
        filters: { email: `eq.${email}`, consumed_at: "is.null" },
        body: { consumed_at: new Date().toISOString() },
      });

      const okInsert = await pgInsert({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "password_reset_otps",
        body: {
          email,
          otp_hash: otpHash,
          otp_salt: otpSalt,
          expires_at: expires,
        },
      });
      if (!okInsert) return json({ error: "Failed to create OTP" }, { status: 500 });

      if (!RESEND_API_KEY) return json({ ok: true });

      const html = otpEmailHtml({ appName: APP_NAME, otp, minutes: 10 });

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [email],
          subject: `${APP_NAME} password reset OTP`,
          html,
        }),
      });

      if (!sendRes.ok) {
        return json({ error: "Failed to send email" }, { status: 500 });
      }

      return json({ ok: true });
    }

    if (action === "verify") {
      const email = (body?.email ?? "").toString().trim().toLowerCase();
      const otp = (body?.otp ?? "").toString().trim();

      if (!isValidEmail(email) || otp.length < 4) return json({ error: "Invalid input" }, { status: 400 });

      const row = await pgSelectOne({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "password_reset_otps",
        select: "id,email,otp_hash,otp_salt,attempts,expires_at,consumed_at,created_at",
        filters: {
          email: `eq.${email}`,
          consumed_at: "is.null",
          expires_at: `gt.${new Date().toISOString()}`,
        },
        order: "created_at.desc",
      });

      if (!row) return json({ error: "OTP expired" }, { status: 400 });

      const expected = row.otp_hash;
      const actual = await sha256Hex(`${otp}:${row.otp_salt}:${OTP_PEPPER}`);

      if (expected !== actual) {
        const nextAttempts = (row.attempts ?? 0) + 1;
        await pgPatch({
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
          table: "password_reset_otps",
          filters: { id: `eq.${row.id}` },
          body: {
            attempts: nextAttempts,
            consumed_at: nextAttempts >= 5 ? new Date().toISOString() : null,
          },
        });

        return json({ error: "Invalid OTP" }, { status: 400 });
      }

      const resetToken = base64Url(crypto.getRandomValues(new Uint8Array(32)));
      const tokenSalt = base64Url(crypto.getRandomValues(new Uint8Array(16)));
      const tokenHash = await sha256Hex(`${resetToken}:${tokenSalt}:${OTP_PEPPER}`);

      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const okVerify = await pgPatch({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "password_reset_otps",
        filters: { id: `eq.${row.id}` },
        body: {
          verified_at: new Date().toISOString(),
          token_hash: tokenHash,
          token_salt: tokenSalt,
          expires_at: expires,
        },
      });

      if (!okVerify) return json({ error: "Failed to verify OTP" }, { status: 500 });

      return json({ ok: true, reset_token: resetToken });
    }

    if (action === "reset") {
      const email = (body?.email ?? "").toString().trim().toLowerCase();
      const resetToken = (body?.reset_token ?? "").toString().trim();
      const newPassword = (body?.new_password ?? "").toString();

      if (!isValidEmail(email) || resetToken.length < 16 || newPassword.length < 6) {
        return json({ error: "Invalid input" }, { status: 400 });
      }

      const row = await pgSelectOne({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "password_reset_otps",
        select: "id,email,token_hash,token_salt,expires_at,consumed_at,verified_at",
        filters: {
          email: `eq.${email}`,
          consumed_at: "is.null",
          verified_at: "not.is.null",
          expires_at: `gt.${new Date().toISOString()}`,
        },
        order: "verified_at.desc",
      });

      if (!row) return json({ error: "Session expired" }, { status: 400 });

      const expected = row.token_hash;
      const actual = await sha256Hex(`${resetToken}:${row.token_salt}:${OTP_PEPPER}`);
      if (!expected || expected !== actual) return json({ error: "Invalid token" }, { status: 400 });

      const user = await authUserByEmail({ supabaseUrl: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY, email });
      if (!user) {
        await pgPatch({
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
          table: "password_reset_otps",
          filters: { id: `eq.${row.id}` },
          body: { consumed_at: new Date().toISOString() },
        });
        return json({ ok: true });
      }

      const ok = await updatePassword({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        userId: user.id,
        password: newPassword,
      });

      if (!ok) return json({ error: "Failed to update password" }, { status: 500 });

      await pgPatch({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "password_reset_otps",
        filters: { id: `eq.${row.id}` },
        body: { consumed_at: new Date().toISOString() },
      });

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, { status: 400 });
  } catch (_err) {
    return json({ error: "Unexpected error" }, { status: 500 });
  }
});
