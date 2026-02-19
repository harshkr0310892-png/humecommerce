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
  const orderPublicId = (body?.order_public_id ?? "").toString();
  const sellerId = (body?.seller_id ?? "").toString();
  const message = (body?.message ?? body?.note ?? "").toString();
  return [event, orderId, orderPublicId, sellerId, message].join("\n");
}

function formatStatus(status: string | null | undefined) {
  const s = (status ?? "").toString().trim().toLowerCase();
  if (!s) return "updated";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sellerNotificationEmailHtml(opts: {
  appName: string;
  orderPublicId: string;
  sellerName?: string | null;
  event: string;
  orderDetails?: any;
  message?: string | null;
  products?: any[];
  paymentMethod?: string | null;
  totalAmount?: number;
  returnReason?: string | null;
  returnStatus?: string | null;
}) {
  let title = "";
  let description = "";
  
  switch (opts.event) {
    case "new_order":
      title = "New Order Received";
      description = `You have received a new order <b>#${opts.orderPublicId}</b>`;
      break;
    case "return_requested":
      title = "Return Requested";
      description = `A return request has been made for order <b>#${opts.orderPublicId}</b>`;
      break;
    case "order_cancelled":
      title = "Order Cancelled";
      description = `Order <b>#${opts.orderPublicId}</b> has been cancelled`;
      break;
    case "return_cancelled":
      title = "Return Request Cancelled";
      description = `Return request for order <b>#${opts.orderPublicId}</b> has been cancelled`;
      break;
    case "return_approved":
      title = "Return Approved";
      description = `Return request for order <b>#${opts.orderPublicId}</b> has been approved`;
      break;
    case "return_rejected":
      title = "Return Rejected";
      description = `Return request for order <b>#${opts.orderPublicId}</b> has been rejected`;
      break;
    default:
      title = "Order Update";
      description = `There is an update for order <b>#${opts.orderPublicId}</b>`;
  }

  const customerName = opts.orderDetails?.customer_name || "Unknown Customer";
  const customerPhone = opts.orderDetails?.customer_phone || "N/A";
  const customerAddress = opts.orderDetails?.customer_address || "N/A";
  const paymentMethod = opts.paymentMethod || opts.orderDetails?.payment_method || "N/A";
  const totalAmount = opts.totalAmount || opts.orderDetails?.total || 0;
  const orderDate = opts.orderDetails?.created_at ? new Date(opts.orderDetails.created_at).toLocaleString() : "N/A";

  const productsList = opts.products && opts.products.length > 0 
    ? opts.products.map(p => `
      <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #e7e9f2; border-radius: 8px;">
        <div style="font-weight: 600; color: #0f172a; margin-bottom: 4px;">${p.name}</div>
        <div style="font-size: 13px; color: #64748b;">
          Quantity: ${p.quantity || 1} | Price: ₹${p.price?.toFixed(2) || 'N/A'}
          ${p.variant_details ? `<br/>Variant: ${p.variant_details}` : ''}
          ${p.attribute_details ? `<br/>Attribute: ${p.attribute_details}` : ''}
        </div>
      </div>
    `).join('')
    : '<div style="padding: 12px; border: 1px solid #e7e9f2; border-radius: 8px; text-align: center; color: #64748b;">No product details available</div>';

  const returnInfo = opts.returnReason 
    ? `
      <div style="margin: 14px 0; padding: 14px; border: 1px solid #e7e9f2; border-radius: 12px; background: #fffbeb; color: #0f172a;">
        <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">Return Information</div>
        <div style="font-size: 14px; line-height: 1.5;"><b>Reason:</b> ${opts.returnReason}</div>
        ${opts.returnStatus ? `<div style="font-size: 14px; line-height: 1.5; margin-top: 4px;"><b>Status:</b> ${opts.returnStatus}</div>` : ''}
      </div>
    `
    : '';

  const msg = (opts.message ?? "").toString().trim();
  const greeting = opts.sellerName ? `Hi ${opts.sellerName},` : "Hi Seller,";

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
            ${description}.
          </p>
          
          ${returnInfo}
          
          <div style="margin:14px 0 20px;">
            <div style="font-weight:600;font-size:14px;margin-bottom:8px;color:#0f172a;">Order Details</div>
            
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="color:#64748b;">Order ID:</span>
                <span style="font-weight:600;color:#0f172a;">#${opts.orderPublicId}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="color:#64748b;">Customer Name:</span>
                <span style="color:#0f172a;">${customerName}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="color:#64748b;">Customer Phone:</span>
                <span style="color:#0f172a;">${customerPhone}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="color:#64748b;">Payment Method:</span>
                <span style="color:#0f172a;">${paymentMethod}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="color:#64748b;">Total Amount:</span>
                <span style="font-weight:600;color:#0f172a;">₹${totalAmount.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="color:#64748b;">Order Date:</span>
                <span style="color:#0f172a;">${orderDate}</span>
              </div>
            </div>
            
            <div style="margin-top:16px;">
              <div style="font-weight:600;font-size:14px;margin-bottom:8px;color:#0f172a;">Products Ordered</div>
              ${productsList}
            </div>
            
            <div style="margin-top:16px;">
              <div style="font-weight:600;font-size:14px;margin-bottom:8px;color:#0f172a;">Shipping Address</div>
              <div style="color:#0f172a;white-space:pre-wrap;">${customerAddress}</div>
            </div>
          </div>
          
          ${
            msg
              ? `<div style="margin:14px 0 10px;padding:14px 14px;border:1px solid #e7e9f2;border-radius:12px;background:#ffffff;color:#0f172a;">
                  <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Additional Info</div>
                  <div style="font-size:14px;line-height:1.55;white-space:pre-wrap;">${msg
                    .replaceAll("&", "&amp;")
                    .replaceAll("<", "&lt;")
                    .replaceAll(">", "&gt;")}</div>
                </div>`
              : ""
          }
          
          <div style="margin-top:18px;font-size:12px;line-height:1.55;color:#64748b;">
            Login to your seller dashboard to manage this order.
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

async function pgSelect(params: {
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

  const res = await fetch(url.toString(), {
    headers: {
      ...postgrestBaseHeaders(serviceRoleKey),
      accept: "application/json",
    },
  });

  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data as any[];
}

async function pgSelectOne(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  table: string;
  select: string;
  filters: Record<string, string>;
}) {
  const rows = await pgSelect(params);
  return rows.length > 0 ? rows[0] : null;
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
    const WEBHOOK_SECRET = Deno.env.get("SELLER_NOTIFIER_WEBHOOK_SECRET") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing Supabase service role configuration" }, { status: 500 });
    }

    const raw = await req.text().catch(() => "");
    const body = raw ? JSON.parse(raw) : null;
    const event = (body?.event ?? "manual").toString();
    const rawOrderId = (body?.order_id ?? body?.order_uuid ?? body?.id ?? "").toString().trim();
    const sellerId = (body?.seller_id ?? "").toString().trim();

    if (!rawOrderId) return json({ error: "Missing order_id" }, { status: 400 });
    if (!sellerId) return json({ error: "Missing seller_id" }, { status: 400 });

    if (WEBHOOK_SECRET) {
      const sigHeader = req.headers.get("x-seller-notifier-signature") ?? "";
      const provided = sigHeader.startsWith("sha256=") ? sigHeader.slice("sha256=".length) : sigHeader;
      const expected = await hmacSha256Hex(WEBHOOK_SECRET, signatureBaseFromBody(body));
      if (!provided || !timingSafeEqualHex(provided, expected)) {
        return json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const lookupByUuid = isUuid(rawOrderId);
    if (!lookupByUuid) {
      return json({ error: "order_id must be a UUID" }, { status: 400 });
    }

    // Get order details
    const order = await pgSelectOne({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      table: "orders",
      select: "id,order_id,customer_name,customer_email,customer_phone,customer_address,status,payment_method,total,created_at,updated_at,return_status,return_reason,return_request_date",
      filters: { id: `eq.${rawOrderId}` },
    });

    if (!order) return json({ error: "Order not found" }, { status: 404 });

    // Get order items
    const orderItems = await pgSelect({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      table: "order_items",
      select: "id,product_id,quantity,price,variant_details,attribute_details,product:products(name)",
      filters: { order_id: `eq.${rawOrderId}` },
    });

    // Get product details for order items
    const products = orderItems.map(item => ({
      id: item.product_id,
      name: item.product?.name || 'Unknown Product',
      quantity: item.quantity,
      price: item.price,
      variant_details: item.variant_details || null,
      attribute_details: item.attribute_details || null
    }));

    // Get seller notification emails
    const sellerNotificationEmails = await pgSelect({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      table: "seller_notification_emails",
      select: "email",
      filters: { seller_id: `eq.${sellerId}` },
    });

    if (sellerNotificationEmails.length === 0) {
      return json({ ok: true, skipped: true, reason: "No notification emails configured for seller" });
    }

    const toEmails = sellerNotificationEmails.map(emailObj => emailObj.email);
    if (toEmails.length === 0) return json({ ok: true, skipped: true, reason: "No valid emails found" });

    const message = (body?.message ?? body?.note ?? "").toString();
    const seller = await pgSelectOne({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      table: "sellers",
      select: "name",
      filters: { id: `eq.${sellerId}` },
    });

    const subject =
      event === "new_order"
        ? `${APP_NAME}: New Order #${order.order_id}`
        : event === "return_requested"
          ? `${APP_NAME}: Return Requested for Order #${order.order_id}`
          : event === "order_cancelled"
            ? `${APP_NAME}: Order #${order.order_id} Cancelled`
            : event === "return_cancelled"
              ? `${APP_NAME}: Return Request Cancelled for Order #${order.order_id}`
              : `${APP_NAME}: Order Update (#${order.order_id})`;

    const html = sellerNotificationEmailHtml({
      appName: APP_NAME,
      orderPublicId: order.order_id,
      sellerName: seller?.name,
      event,
      orderDetails: order,
      products,
      paymentMethod: order.payment_method,
      totalAmount: order.total,
      returnReason: order.return_reason,
      returnStatus: order.return_status,
      message,
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
        to: toEmails,
        subject,
        html,
      }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text().catch(() => "");
      console.error("RESEND_SEND_FAILED", {
        status: sendRes.status,
        statusText: sendRes.statusText,
        toEmails,
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
    console.error("SELLER_NOTIFIER_ERROR", _err);
    return json({ error: "Unexpected error" }, { status: 500 });
  }
});