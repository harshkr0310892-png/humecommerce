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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function hmacSha256Hex(secret: string, input: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string) {
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return out === 0;
}

function signatureBaseFromBody(body: any) {
  const event = (body?.event ?? "").toString();
  const orderId = (body?.order_id ?? body?.order_uuid ?? body?.id ?? "").toString();
  const newStatus = (body?.new_status ?? body?.status ?? "").toString();
  const oldStatus = (body?.old_status ?? "").toString();
  const message = (body?.message ?? body?.note ?? "").toString();
  const actorEmail = normalizeEmail(body?.actor_email) ?? "";
  return [event, orderId, oldStatus, newStatus, message, actorEmail].join("\n");
}

function formatStatus(status: string | null | undefined) {
  const s = (status ?? "").toString().trim().toLowerCase();
  if (!s) return "updated";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function actorLabel(actor?: string | null) {
  const raw = (actor ?? "").toString().trim();
  if (!raw) return "Team";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return raw;
  const a = raw.toLowerCase();
  if (a === "admin") return "Support Team";
  if (a === "seller") return "Seller";
  if (a === "delivery_boy" || a === "delivery" || a === "rider") return "Delivery Partner";
  return a.charAt(0).toUpperCase() + a.slice(1);
}

function orderUpdateEmailHtml(opts: {
  appName: string;
  orderPublicId: string;
  customerName?: string | null;
  event: string;
  newStatus?: string | null;
  oldStatus?: string | null;
  message?: string | null;
  actor?: string | null;
  trackUrl?: string | null;
}) {
  const title =
    opts.event === "order_status_changed"
      ? `Order ${formatStatus(opts.newStatus)}`
      : opts.event === "order_message_created"
        ? "New update on your order"
        : "Order update";

  const statusLine =
    opts.event === "order_status_changed" && opts.newStatus
      ? `Status: <b>${formatStatus(opts.newStatus)}</b>${opts.oldStatus ? ` (was ${formatStatus(opts.oldStatus)})` : ""}`
      : "";

  const msg = (opts.message ?? "").toString().trim();
  const customerName = (opts.customerName ?? "").toString().trim();
  const greeting = customerName ? `Hi ${customerName},` : "Hi,";

  const trackButton = opts.trackUrl
    ? `<a href="${opts.trackUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700;font-size:14px;">Track your order</a>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${opts.appName} - ${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border:1px solid #e7e9f2;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
        <div style="padding:22px 22px 18px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;">
          <div style="font-size:18px;font-weight:800;letter-spacing:0.2px;">${opts.appName}</div>
          <div style="margin-top:6px;font-size:14px;opacity:0.95;">${title}</div>
        </div>
        <div style="padding:22px;">
          <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#0f172a;">${greeting}</p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#0f172a;">
            We have an update for your order <b>#${opts.orderPublicId}</b>.
          </p>
          ${
            statusLine
              ? `<div style="margin:14px 0 10px;padding:14px 14px;border:1px solid #e7e9f2;border-radius:12px;background:#f8fafc;color:#0f172a;font-size:14px;line-height:1.55;">${statusLine}</div>`
              : ""
          }
          ${
            msg
              ? `<div style="margin:14px 0 10px;padding:14px 14px;border:1px solid #e7e9f2;border-radius:12px;background:#ffffff;color:#0f172a;">
                  <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Message from ${actorLabel(opts.actor)}</div>
                  <div style="font-size:14px;line-height:1.55;white-space:pre-wrap;">${msg
                    .replaceAll("&", "&amp;")
                    .replaceAll("<", "&lt;")
                    .replaceAll(">", "&gt;")}</div>
                </div>`
              : ""
          }
          ${trackButton ? `<div style="margin-top:16px;">${trackButton}</div>` : ""}
          <div style="margin-top:18px;font-size:12px;line-height:1.55;color:#64748b;">
            If you did not place this order, please ignore this email.
          </div>
        </div>
      </div>
      <div style="text-align:center;margin-top:12px;font-size:11px;color:#94a3b8;">
        © ${new Date().getFullYear()} ${opts.appName}
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
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as any;
}

async function authEmailByUserId(params: { supabaseUrl: string; serviceRoleKey: string; userId: string }) {
  const { supabaseUrl, serviceRoleKey, userId } = params;
  const url = `${supabaseUrl}/auth/v1/admin/users/${userId}`;
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "content-type": "application/json",
    },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const email = typeof data?.email === "string" ? data.email : null;
  return email ? email.toString().trim().toLowerCase() : null;
}

function normalizeEmail(email: unknown) {
  const e = (email ?? "").toString().trim().toLowerCase();
  if (!e) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
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
    const TRACK_BASE_URL = Deno.env.get("TRACK_BASE_URL") ?? "";
    const ALLOW_LOOKUP_BY_PUBLIC_ORDER_ID = (Deno.env.get("ALLOW_LOOKUP_BY_PUBLIC_ORDER_ID") ?? "").toLowerCase() === "true";
    const WEBHOOK_SECRET = Deno.env.get("ORDER_NOTIFIER_WEBHOOK_SECRET") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing Supabase service role configuration" }, { status: 500 });
    }

    const raw = await req.text().catch(() => "");
    const body = raw ? JSON.parse(raw) : null;
    const event = (body?.event ?? "manual").toString();
    const rawOrderId = (body?.order_id ?? body?.order_uuid ?? body?.id ?? "").toString().trim();

    if (!rawOrderId) return json({ error: "Missing order_id" }, { status: 400 });

    if (WEBHOOK_SECRET) {
      const sigHeader = req.headers.get("x-order-notifier-signature") ?? "";
      const provided = sigHeader.startsWith("sha256=") ? sigHeader.slice("sha256=".length) : sigHeader;
      const expected = await hmacSha256Hex(WEBHOOK_SECRET, signatureBaseFromBody(body));
      if (!provided || !timingSafeEqualHex(provided, expected)) {
        return json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const lookupByUuid = isUuid(rawOrderId);
    if (!lookupByUuid && !ALLOW_LOOKUP_BY_PUBLIC_ORDER_ID) {
      return json({ error: "order_id must be a UUID" }, { status: 400 });
    }

    const order = await pgSelectOne({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      table: "orders",
      select: "id,order_id,customer_name,customer_email,status,user_id,created_at,updated_at",
      filters: lookupByUuid ? { id: `eq.${rawOrderId}` } : { order_id: `eq.${rawOrderId}` },
    });

    if (!order) return json({ error: "Order not found" }, { status: 404 });

    const toEmail =
      normalizeEmail(body?.to_email) ??
      normalizeEmail(order?.customer_email) ??
      (order?.user_id ? await authEmailByUserId({ supabaseUrl: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY, userId: order.user_id }) : null);

    if (!toEmail) return json({ ok: true, skipped: true, reason: "Missing customer email" });

    const newStatus = (body?.new_status ?? body?.status ?? order?.status ?? "").toString();
    const oldStatus = (body?.old_status ?? "").toString();
    const message = (body?.message ?? body?.note ?? "").toString();
    const actor = normalizeEmail(body?.actor_email) ?? (body?.actor ?? "").toString();

    const trackUrl = TRACK_BASE_URL
      ? `${TRACK_BASE_URL.replace(/\/+$/, "")}/track-order?orderId=${encodeURIComponent(order.order_id)}`
      : null;

    const subject =
      event === "order_status_changed"
        ? `${APP_NAME}: Order #${order.order_id} ${formatStatus(newStatus)}`
        : event === "order_message_created"
          ? `${APP_NAME}: New update on order #${order.order_id}`
          : `${APP_NAME}: Order update (#${order.order_id})`;

    const html = orderUpdateEmailHtml({
      appName: APP_NAME,
      orderPublicId: order.order_id,
      customerName: order.customer_name,
      event,
      newStatus,
      oldStatus,
      message,
      actor,
      trackUrl,
    });

    if (!RESEND_API_KEY) return json({ ok: true, skipped: true, reason: "Missing RESEND_API_KEY" });

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text().catch(() => "");
      console.error("RESEND_SEND_FAILED", {
        status: sendRes.status,
        statusText: sendRes.statusText,
        toEmail,
        from: RESEND_FROM,
        event,
        orderId: order?.id,
        orderPublicId: order?.order_id,
        body: errText,
      });
      return json({ error: "Failed to send email" }, { status: 500 });
    }

    return json({ ok: true });
  } catch (_err) {
    return json({ error: "Unexpected error" }, { status: 500 });
  }
});

