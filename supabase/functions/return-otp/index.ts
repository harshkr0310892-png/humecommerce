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

function base64UrlToBytes(b64url: string) {
  const base64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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

function parseJwtUserId(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payloadBytes = base64UrlToBytes(parts[1] ?? "");
    const payloadText = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadText) as { role?: unknown; sub?: unknown; email?: unknown };
    if (payload.role !== "authenticated") return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
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
}) {
  const { supabaseUrl, serviceRoleKey, table, select, filters } = params;
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  for (const [k, v] of Object.entries(filters)) url.searchParams.set(k, v);
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

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sendEmailOtp(params: { resendApiKey: string; from: string; to: string; otp: string; orderPublicId: string; appName: string }) {
  const { resendApiKey, from, to, otp, orderPublicId, appName } = params;
  const subject = `${appName} Return OTP: ${otp}`;
  
  const otpDigits = otp.split('').map(digit => `
    <td style="width:48px;height:60px;background:linear-gradient(180deg,#1e3a8a 0%,#1e40af 100%);border-radius:12px;text-align:center;vertical-align:middle;margin:0 4px;box-shadow:0 4px 15px rgba(30,58,138,0.4),inset 0 1px 0 rgba(255,255,255,0.1);border:1px solid rgba(96,165,250,0.3);">
      <span style="font-size:28px;font-weight:800;color:#ffffff;text-shadow:0 2px 4px rgba(0,0,0,0.2);font-family:'Segoe UI',Roboto,Arial,sans-serif;">${digit}</span>
    </td>
  `).join('<td style="width:8px;"></td>');

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName} - Return OTP</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    body { margin:0; padding:0; background:#f8fafc; font-family:'Inter', system-ui, -apple-system, sans-serif; }
    .container { max-width: 480px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    
    .header { 
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
      padding: 32px 40px; 
      text-align: center; 
      color: #ffffff;
    }
    .logo { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .subtitle { margin: 8px 0 0; font-size: 14px; opacity: 0.9; font-weight: 500; }

    .body { padding: 40px 40px 32px; text-align: center; color: #1e293b; }
    .greeting { font-size: 18px; font-weight: 600; margin: 0 0 20px; color: #0f172a; }
    .message { font-size: 16px; line-height: 1.6; color: #475569; margin: 0 0 32px; }
    
    .otp-box {
      background: #f1f5f9;
      border: 2px dashed #0ea5e9;
      border-radius: 16px;
      padding: 24px 16px;
      margin: 32px 0;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #0f172a;
      background: linear-gradient(white, white) padding-box,
                  linear-gradient(135deg, #0ea5e9, #38bdf8) border-box;
    }
    
    .order-badge {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 8px 0 24px;
    }

    .warning {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      color: #92400e;
      padding: 16px;
      border-radius: 12px;
      font-size: 14px;
      margin: 32px 0;
      line-height: 1.5;
    }

    .footer {
      background: #f8fafc;
      padding: 24px 40px;
      text-align: center;
      font-size: 13px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer a { color: #0ea5e9; text-decoration: none; font-weight: 500; }

    @media (max-width: 540px) {
      .container { margin: 16px; border-radius: 14px; }
      .header, .body, .footer { padding: 24px !important; }
      .otp-box { font-size: 32px; letter-spacing: 6px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">${appName}</div>
      <div class="subtitle">Return Request Verification</div>
    </div>

    <div class="body">
      <h1 class="greeting">Here’s your Return OTP</h1>
      <p class="message">
        your order <strong>${orderPublicId}</strong> if you want to return it.<br />
        To confirm, please use the OTP given below.
      </p>

      <div class="order-badge">Order ID: ${orderPublicId}</div>

      <div class="otp-box">${otp}</div>

      <div class="warning">
        <strong>⚠️ This otp will expires in just 10 minute.</strong><br />
        please keep it secure do not share it.
      </div>

      <p class="message" style="font-size:14px; color:#64748b;">
        If you did not make this request, please ignore this email.
      </p>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} ${appName} • All rights reserved<br />
      Need help? Contact <a href="mailto:store@cartlyfy.com">store@cartlyfy.com</a>
    </div>
  </div>
</body>
</html>
`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const APP_NAME = Deno.env.get("APP_NAME") ?? "cartlyfy";
    const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "store@cartlyfy.com";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing Supabase service role configuration" }, { status: 500 });
    }

    const userId = parseJwtUserId(req);
    if (!userId) return json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null) as any;
    const action = (body?.action ?? "").toString();
    const orderId = (body?.order_id ?? "").toString();
    const otp = (body?.otp ?? "").toString().trim();

    if (!action) return json({ error: "Missing action" }, { status: 400 });
    if (!orderId || !isValidUuid(orderId)) return json({ error: "Invalid order_id" }, { status: 400 });

    const order = await pgSelectOne({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      table: "orders",
      select: "id,order_id,user_id,status,created_at,customer_email,return_status",
      filters: { id: `eq.${orderId}` },
    }) as any | null;

    if (!order) return json({ error: "Order not found" }, { status: 404 });
    if (order.user_id !== userId) return json({ error: "Forbidden" }, { status: 403 });
    if ((order.status || "").toString().toLowerCase() !== "delivered") return json({ error: "Order is not delivered" }, { status: 400 });
    if (order.return_status) return json({ error: "Return already requested" }, { status: 400 });

    const email = (order.customer_email ?? "").toString().trim().toLowerCase();
    if (!email) return json({ error: "Missing customer email" }, { status: 400 });

    const nowIso = new Date().toISOString();

    if (action === "request" || action === "resend") {
      if (!RESEND_API_KEY || !RESEND_FROM) {
        return json({ error: "Missing email configuration" }, { status: 500 });
      }

      const last = await pgSelectOne({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "return_otps",
        select: "id,created_at,expires_at,consumed_at",
        filters: { user_id: `eq.${userId}`, order_id: `eq.${orderId}`, consumed_at: "is.null" },
      }) as any | null;

      if (last?.created_at) {
        const ageMs = Date.now() - new Date(last.created_at).getTime();
        if (ageMs < 10_000) {
          return json({ ok: true, throttled: true });
        }
      }

      const newOtp = randomDigits(6);
      const salt = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
      const pepper = Deno.env.get("OTP_PEPPER") ?? "";
      const hash = await sha256Hex(`${newOtp}:${salt}:${pepper}`);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await pgPatch({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "return_otps",
        filters: { user_id: `eq.${userId}`, order_id: `eq.${orderId}`, consumed_at: "is.null" },
        body: { consumed_at: nowIso },
      });

      const okInsert = await pgInsert({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "return_otps",
        body: {
          user_id: userId,
          order_id: orderId,
          otp_hash: hash,
          otp_salt: salt,
          expires_at: expiresAt,
        },
      });
      if (!okInsert) return json({ error: "Failed to create OTP" }, { status: 500 });

      const okEmail = await sendEmailOtp({ resendApiKey: RESEND_API_KEY, from: RESEND_FROM, to: email, otp: newOtp, orderPublicId: order.order_id, appName: APP_NAME });
      if (!okEmail) return json({ error: "Failed to send OTP" }, { status: 500 });

      return json({ ok: true, expires_at: expiresAt });
    }

    if (action === "verify") {
      if (!otp || !/^\d{6}$/.test(otp)) return json({ error: "Invalid OTP" }, { status: 400 });

      const row = await pgSelectOne({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "return_otps",
        select: "id,otp_hash,otp_salt,expires_at,consumed_at,attempts",
        filters: { user_id: `eq.${userId}`, order_id: `eq.${orderId}`, consumed_at: "is.null" },
      }) as any | null;

      if (!row) return json({ error: "OTP not found" }, { status: 400 });
      const attempts = Number(row.attempts ?? 0);
      if (attempts >= 5) return json({ error: "Too many attempts. Please resend OTP." }, { status: 400 });
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return json({ error: "OTP expired" }, { status: 400 });

      const pepper = Deno.env.get("OTP_PEPPER") ?? "";
      const hash = await sha256Hex(`${otp}:${row.otp_salt}:${pepper}`);
      if (hash !== row.otp_hash) {
        const nextAttempts = attempts + 1;
        await pgPatch({
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
          table: "return_otps",
          filters: { id: `eq.${row.id}` },
          body: { attempts: nextAttempts, ...(nextAttempts >= 5 ? { consumed_at: nowIso } : {}) },
        });
        return json({ error: "Invalid OTP" }, { status: 400 });
      }

      await pgPatch({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        table: "return_otps",
        filters: { id: `eq.${row.id}` },
        body: { consumed_at: nowIso, attempts: attempts },
      });

      return json({ ok: true });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, { status: 500 });
  }
});
