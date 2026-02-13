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

type IncomingMessage = { role: string; content: string; images?: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(v)) return true;
    if (["false", "0", "no", "n", "off"].includes(v)) return false;
  }
  return fallback;
}

function parseMessages(value: unknown): IncomingMessage[] | null {
  if (!Array.isArray(value)) return null;
  const out: IncomingMessage[] = [];
  for (const m of value) {
    if (!isRecord(m)) return null;
    const role = typeof m.role === "string" ? m.role : "";
    const content = typeof m.content === "string" ? m.content : "";
    
    // Handle both old single 'imageUrl' and new 'images' array
    let images: string[] = [];
    if (Array.isArray(m.images)) {
      images = m.images.filter((img): img is string => typeof img === "string");
    } else if (typeof m.imageUrl === "string") {
      images = [m.imageUrl];
    }

    if (!role || !content) return null;
    out.push({ role, content, images });
  }
  return out;
}

function normalizeModel(value: unknown) {
  const m = typeof value === "string" ? value.trim() : "";
  return m || "gemini-3-flash-preview";
}

function normalizeTemperature(value: unknown) {
  const t = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(t)) return 0.1;
  return Math.max(0, Math.min(2, t));
}

function lastUserQuery(messages: IncomingMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return (messages[i]?.content ?? "").trim();
  }
  return "";
}

type WebSearchResult = { title: string; url: string; snippet: string };

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
  filters?: Record<string, string>;
  order?: string;
  limit?: number;
}) {
  const { supabaseUrl, serviceRoleKey, table, select, filters, order, limit } = params;
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  if (filters) for (const [k, v] of Object.entries(filters)) url.searchParams.set(k, v);
  if (order) url.searchParams.set("order", order);
  if (typeof limit === "number") url.searchParams.set("limit", String(Math.max(1, Math.min(50, limit))));

  const res = await fetch(url.toString(), {
    headers: {
      ...postgrestBaseHeaders(serviceRoleKey),
      accept: "application/json",
    },
  });

  const text = await res.text().catch(() => "");
  const data = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data, error: res.ok ? null : data };
}

function uniqueNonEmptyStrings(values: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function extractSearchTerms(query: string) {
  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "for",
    "of",
    "in",
    "on",
    "with",
    "me",
    "my",
    "i",
    "you",
    "your",
    "need",
    "want",
    "please",
    "show",
    "suggest",
    "recommend",
    "best",
    "good",
    "buy",
    "order",
    "len",
    "lena",
    "chahiye",
    "chaiye",
    "batao",
    "karo",
    "kar",
    "hai",
    "ho",
    "ka",
    "ki",
    "ke",
    "ye",
    "yah",
    "ya",
  ]);

  const cleaned = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s₹$.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const rawTerms = cleaned.split(" ").filter((t) => t.length >= 3 && !stop.has(t));
  return uniqueNonEmptyStrings(rawTerms).slice(0, 8);
}

function shouldInjectProductContext(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (q.length < 4) return false;
  if (/^(hi|hello|hey|hlo|namaste|hola)\b/.test(q) && q.split(/\s+/).length <= 3) return false;
  if (/(joke|poem|shayari|quote|story|translate|meaning|define|weather|time|date)\b/.test(q)) return false;
  if (/(₹|rs\.?|inr|\$|price|budget|under|below|recommend|suggest|best|buy|order|purchase|kharid|chahiye|lena)/.test(q)) return true;
  return extractSearchTerms(q).length > 0;
}

type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  detailed_description: string | null;
  price: number | null;
  discount_percentage: number | null;
  image_url: string | null;
  images: string[] | null;
  stock_status: string | null;
  stock_quantity: number | null;
  category_id: string | null;
  brand: string | null;
  seller_name: string | null;
  is_active?: boolean | null;
};

type ShopReviewSummary = { product_id: string; avg_rating: number | null; review_count: number | null };

type VariantRow = {
  id: string;
  product_id: string;
  price: number | null;
  stock_quantity: number | null;
  is_available: boolean | null;
  product_variant_values?: Array<{
    attribute_value_id: string;
    product_attribute_values?: {
      id: string;
      value: string;
      attribute_id: string;
      product_attributes?: { id: string; name: string };
    };
  }>;
};

function effectivePrice(product: ShopProduct) {
  const price = typeof product.price === "number" ? product.price : null;
  const disc = typeof product.discount_percentage === "number" ? product.discount_percentage : 0;
  if (price === null) return null;
  if (!disc) return price;
  const v = price * (1 - disc / 100);
  return Math.round(v * 100) / 100;
}

function productBestImage(product: ShopProduct) {
  const first = Array.isArray(product.images) && typeof product.images[0] === "string" ? product.images[0] : null;
  return product.image_url ?? first ?? null;
}

function buildProductOrFilter(terms: string[]) {
  const fields = ["name", "description", "detailed_description", "brand", "seller_name"];
  const clauses: string[] = [];
  for (const t of terms) {
    const safe = t.replace(/\*/g, "").replace(/,/g, " ").trim();
    if (!safe) continue;
    for (const f of fields) clauses.push(`${f}.ilike.*${safe}*`);
  }
  return clauses.length > 0 ? `(${clauses.join(",")})` : null;
}

function scoreProduct(p: ShopProduct, terms: string[], rating: number | null) {
  const hay = `${p.name} ${(p.description ?? "")} ${(p.brand ?? "")}`.toLowerCase();
  let matches = 0;
  for (const t of terms) if (hay.includes(t.toLowerCase())) matches += 1;
  let score = matches * 3;
  if ((p.stock_status ?? "").toLowerCase() === "in_stock") score += 5;
  if ((p.stock_quantity ?? 0) > 0) score += 2;
  if ((p.discount_percentage ?? 0) > 0) score += 1;
  if (typeof rating === "number") score += Math.max(0, Math.min(5, rating));
  return score;
}

function summarizeVariantAttributes(variants: VariantRow[]) {
  const map = new Map<string, Set<string>>();
  for (const v of variants) {
    const pvv = Array.isArray(v.product_variant_values) ? v.product_variant_values : [];
    for (const x of pvv) {
      const pav = x.product_attribute_values;
      const attrName = pav?.product_attributes?.name;
      const value = pav?.value;
      if (!attrName || !value) continue;
      if (!map.has(attrName)) map.set(attrName, new Set<string>());
      map.get(attrName)!.add(value);
    }
  }
  const parts: string[] = [];
  for (const [attr, values] of map.entries()) {
    const list = Array.from(values).slice(0, 6).join(", ");
    if (!list) continue;
    parts.push(`${attr}: ${list}${values.size > 6 ? "…" : ""}`);
    if (parts.length >= 4) break;
  }
  return parts.join(" | ");
}

function variantCombinationLabel(variant: VariantRow) {
  const pvv = Array.isArray(variant.product_variant_values) ? variant.product_variant_values : [];
  const pairs: Array<{ k: string; v: string }> = [];
  for (const x of pvv) {
    const pav = x.product_attribute_values;
    const k = pav?.product_attributes?.name;
    const v = pav?.value;
    if (!k || !v) continue;
    pairs.push({ k, v });
  }
  if (pairs.length === 0) return null;
  pairs.sort((a, b) => a.k.localeCompare(b.k));
  return pairs.map((p) => `${p.k}: ${p.v}`).join(", ");
}

function computeVariantStock(variants: VariantRow[]) {
  const totalVariants = variants.length;
  let availableVariants = 0;
  let availableStock = 0;
  const samples: string[] = [];

  for (const v of variants) {
    const isAvailable = v.is_available !== false;
    const qty = typeof v.stock_quantity === "number" && v.stock_quantity > 0 ? v.stock_quantity : 0;
    if (isAvailable && qty > 0) {
      availableVariants += 1;
      availableStock += qty;
    }
    const label = variantCombinationLabel(v);
    if (label && !samples.includes(label)) samples.push(label);
  }

  return {
    hasVariants: totalVariants > 0,
    totalVariants,
    availableVariants,
    availableStock,
    sampleLabels: samples.slice(0, 4),
  };
}

async function buildShopProductContext(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  query: string;
  shopBasePath: string;
}) {
  const { supabaseUrl, serviceRoleKey, query, shopBasePath } = params;
  const terms = extractSearchTerms(query);
  if (terms.length === 0) return { text: "", meta: { used: false, products_count: 0 } };

  const or = buildProductOrFilter(terms);
  const baseFilters: Record<string, string> = {};
  if (or) baseFilters.or = or;

  const selectWithActive =
    "id,name,description,detailed_description,price,discount_percentage,image_url,images,stock_status,stock_quantity,category_id,brand,seller_name,is_active";
  const selectWithoutActive =
    "id,name,description,detailed_description,price,discount_percentage,image_url,images,stock_status,stock_quantity,category_id,brand,seller_name";

  const categoryTerms = terms.slice(0, 6).map((t) => t.replace(/\*/g, "").replace(/,/g, " ").trim()).filter(Boolean);
  let matchedCategories: Array<{ id: string; name: string }> = [];
  if (categoryTerms.length > 0) {
    const catClauses = categoryTerms.map((t) => `name.ilike.*${t}*`);
    const catsRes = await pgSelect({
      supabaseUrl,
      serviceRoleKey,
      table: "categories",
      select: "id,name",
      filters: { or: `(${catClauses.join(",")})`, is_active: "eq.true" },
      order: "sort_order.asc",
      limit: 10,
    }).catch(() => ({ ok: false, status: 0, data: null, error: null }));
    if (catsRes.ok && Array.isArray(catsRes.data)) {
      matchedCategories = (catsRes.data as Array<any>)
        .map((c) => ({ id: typeof c?.id === "string" ? c.id : "", name: typeof c?.name === "string" ? c.name : "" }))
        .filter((c) => c.id && c.name)
        .slice(0, 3);
    }
  }

  const categoryIdFilter =
    matchedCategories.length > 0 ? `in.(${matchedCategories.map((c) => `"${c.id}"`).join(",")})` : null;

  let productsRes = await pgSelect({
    supabaseUrl,
    serviceRoleKey,
    table: "products",
    select: selectWithActive,
    filters: { ...baseFilters, is_active: "eq.true", ...(categoryIdFilter ? { category_id: categoryIdFilter } : {}) },
    order: "created_at.desc",
    limit: 10,
  });
  if (!productsRes.ok) {
    productsRes = await pgSelect({
      supabaseUrl,
      serviceRoleKey,
      table: "products",
      select: selectWithoutActive,
      filters: { ...baseFilters, ...(categoryIdFilter ? { category_id: categoryIdFilter } : {}) },
      order: "created_at.desc",
      limit: 10,
    });
  }

  const products = (Array.isArray(productsRes.data) ? productsRes.data : []) as ShopProduct[];
  if (products.length === 0) return { text: "", meta: { used: true, products_count: 0 } };
  const ids = products.map((p) => p.id).filter((id) => typeof id === "string" && id);
  const inFilter = ids.length > 0 ? `in.(${ids.map((id) => `"${id}"`).join(",")})` : "";

  const categoryIds = Array.from(new Set(products.map((p) => p.category_id).filter((id): id is string => typeof id === "string" && id.length > 0)));
  const categoriesById = new Map<string, string>();
  if (categoryIds.length > 0) {
    const catsByIdRes = await pgSelect({
      supabaseUrl,
      serviceRoleKey,
      table: "categories",
      select: "id,name",
      filters: { id: `in.(${categoryIds.map((id) => `"${id}"`).join(",")})` },
      limit: 50,
    }).catch(() => ({ ok: false, status: 0, data: null, error: null }));
    if (catsByIdRes.ok && Array.isArray(catsByIdRes.data)) {
      for (const c of catsByIdRes.data as Array<any>) {
        const id = typeof c?.id === "string" ? c.id : "";
        const name = typeof c?.name === "string" ? c.name : "";
        if (id && name) categoriesById.set(id, name);
      }
    }
  }

  let reviewMap = new Map<string, ShopReviewSummary>();
  if (inFilter) {
    const reviewsRes = await pgSelect({
      supabaseUrl,
      serviceRoleKey,
      table: "product_review_summary",
      select: "product_id,avg_rating,review_count",
      filters: { product_id: inFilter },
      limit: 50,
    }).catch(() => ({ ok: false, status: 0, data: null, error: null }));
    if (reviewsRes.ok && Array.isArray(reviewsRes.data)) {
      for (const r of reviewsRes.data as ShopReviewSummary[]) {
        if (r?.product_id) reviewMap.set(r.product_id, r);
      }
    }
  }

  let variantsByProduct = new Map<string, VariantRow[]>();
  if (inFilter) {
    const variantsRes = await pgSelect({
      supabaseUrl,
      serviceRoleKey,
      table: "product_variants",
      select:
        "id,product_id,price,stock_quantity,is_available,product_variant_values(attribute_value_id,product_attribute_values(id,value,attribute_id,product_attributes(id,name)))",
      filters: { product_id: inFilter },
      limit: 50,
    });
    if (variantsRes.ok && Array.isArray(variantsRes.data)) {
      const rows = variantsRes.data as VariantRow[];
      for (const v of rows) {
        if (!v?.product_id) continue;
        if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
        variantsByProduct.get(v.product_id)!.push(v);
      }
    }
  }

  const scored = products
    .map((p) => {
      const r = reviewMap.get(p.id);
      const rating = typeof r?.avg_rating === "number" ? r.avg_rating : null;
      return { p, r, score: scoreProduct(p, terms, rating) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const lines: string[] = [];
  lines.push("SHOP PRODUCT CATALOG (use only these products when recommending; if none match, ask 1-2 clarifying questions):");
  if (matchedCategories.length > 0) {
    lines.push(`Matched category(s): ${matchedCategories.map((c) => c.name).join(", ")}`);
  }
  for (const item of scored) {
    const p = item.p;
    const r = item.r;
    const base = shopBasePath.trim().replace(/\/+$/, "");
    const url = base ? `${base}/product/${p.id}` : `/product/${p.id}`;
    const price = effectivePrice(p);
    const priceText = typeof price === "number" ? `₹${price}` : "N/A";
    const mrpText = typeof p.price === "number" && (p.discount_percentage ?? 0) > 0 ? ` (MRP ₹${p.price}, -${p.discount_percentage}%)` : "";
    const variantRows = variantsByProduct.get(p.id) ?? [];
    const variantStock = computeVariantStock(variantRows);
    const productQty = typeof p.stock_quantity === "number" && p.stock_quantity > 0 ? p.stock_quantity : 0;
    const inStockByQty = variantStock.hasVariants ? variantStock.availableStock > 0 : productQty > 0;
    const stockLeft = variantStock.hasVariants ? variantStock.availableStock : productQty;
    const stock =
      inStockByQty
        ? variantStock.hasVariants
          ? `In stock (${stockLeft} left across ${variantStock.availableVariants}/${variantStock.totalVariants} variants)`
          : `In stock (${stockLeft} left)`
        : "Sold out";
    const ratingText =
      typeof r?.avg_rating === "number" ? `${r.avg_rating.toFixed(1)}/5 (${r.review_count ?? 0} reviews)` : "No ratings yet";
    const variants = summarizeVariantAttributes(variantRows);
    const categoryName = p.category_id ? categoriesById.get(p.category_id) : null;
    const catText = categoryName ? ` | Category: ${categoryName}` : "";
    const brand = p.brand ? ` | Brand: ${p.brand}` : "";
    const seller = p.seller_name ? ` | Seller: ${p.seller_name}` : "";
    const hasVariantsText = variantStock.hasVariants ? "Yes" : "No";
    const varText = variants ? ` | Variants: ${variants}` : variantStock.hasVariants ? " | Variants: Yes" : "";
    const exampleText =
      variantStock.hasVariants && variantStock.sampleLabels.length > 0 ? ` | Example: ${variantStock.sampleLabels.join(" / ")}` : "";
    const img = productBestImage(p);
    const imgText = img ? ` | Image: ${img}` : "";
    lines.push(
      `- ${p.name} | ${priceText}${mrpText} | ${stock} | Rating: ${ratingText}${catText}${brand}${seller} | Has variants: ${hasVariantsText}${varText}${exampleText} | Link: ${url}${imgText}`
    );
  }

  lines.push("Recommendation rules:");
  lines.push("- Always suggest 3 best options with short reasons based on user needs/specs/budget.");
  lines.push("- Mention variants/attributes that match the user's request (color/size/etc).");
  lines.push("- Include the product Link for each suggestion.");
  lines.push("- If user asks for 'best' or 'good', prefer higher rating + in-stock + better value.");

  return { text: lines.join("\n"), meta: { used: true, products_count: scored.length } };
}

async function braveWebSearch(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const key = Deno.env.get("BRAVE_SEARCH_API_KEY") ?? "";
  if (!key) return [];
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.max(1, Math.min(10, maxResults))}&safesearch=moderate&text_decorations=false`;
  const res = await fetch(url, {
    headers: {
      "accept": "application/json",
      "X-Subscription-Token": key,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !isRecord(data)) return [];
  const web = data.web;
  if (!isRecord(web) || !Array.isArray(web.results)) return [];
  const results: WebSearchResult[] = [];
  for (const r of web.results) {
    if (!isRecord(r)) continue;
    const title = typeof r.title === "string" ? r.title : "";
    const url = typeof r.url === "string" ? r.url : "";
    const snippet = typeof r.description === "string" ? r.description : "";
    if (!title || !url) continue;
    results.push({ title, url, snippet });
    if (results.length >= maxResults) break;
  }
  return results;
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(input: string) {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeDuckDuckGoRedirectUrl(href: string) {
  const absolute = href.startsWith("http") ? href : `https://duckduckgo.com${href}`;
  const m = absolute.match(/[?&]uddg=([^&]+)/);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return absolute;
    }
  }
  return absolute;
}

async function duckDuckGoHtmlSearch(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "accept": "text/html",
      "user-agent": "Mozilla/5.0 (compatible; CartifyBot/1.0; +https://example.com/bot)",
    },
  });
  if (!res.ok) return [];
  const html = await res.text().catch(() => "");
  if (!html) return [];

  const results: WebSearchResult[] = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && results.length < maxResults) {
    const href = typeof match[1] === "string" ? match[1] : "";
    const rawTitle = typeof match[2] === "string" ? match[2] : "";
    const title = stripTags(rawTitle);
    const decodedUrl = href ? decodeDuckDuckGoRedirectUrl(href) : "";
    if (!title || !decodedUrl) continue;

    const from = match.index;
    const chunk = html.slice(from, Math.min(html.length, from + 1200));
    const snippetMatch = chunk.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/div>/);
    const snippetRaw = (snippetMatch?.[1] ?? snippetMatch?.[2] ?? "").toString();
    const snippet = stripTags(snippetRaw);

    results.push({ title, url: decodedUrl, snippet });
  }
  return results;
}

async function searchWeb(query: string, maxResults: number) {
  const brave = await braveWebSearch(query, maxResults).catch(() => []);
  if (brave.length > 0) return { provider: "brave" as const, results: brave };
  const ddg = await duckDuckGoHtmlSearch(query, maxResults).catch(() => []);
  if (ddg.length > 0) return { provider: "duckduckgo" as const, results: ddg };
  return { provider: "none" as const, results: [] as WebSearchResult[] };
}

function formatWebContext(results: WebSearchResult[]) {
  const lines: string[] = [];
  lines.push("WEB SEARCH RESULTS (use these for factual accuracy, cite them implicitly, and do not invent facts):");
  results.forEach((r, i) => {
    const snip = r.snippet ? ` — ${r.snippet}` : "";
    lines.push(`${i + 1}. ${r.title} (${r.url})${snip}`);
  });
  return lines.join("\n");
}

function injectWebContext(messages: IncomingMessage[], contextText: string) {
  if (!contextText.trim()) return messages;
  const insertAt = Math.max(0, messages.length - 1);
  const injected: IncomingMessage = { role: "user", content: contextText };
  return [...messages.slice(0, insertAt), injected, ...messages.slice(insertAt)];
}

function extractSystemInstruction(messages: IncomingMessage[]) {
  const systemTexts = messages.filter((m) => m.role === "system").map((m) => m.content).filter((t) => t.trim());
  const rest = messages.filter((m) => m.role !== "system");
  return { systemText: systemTexts.join("\n\n").trim(), messages: rest };
}

function base64UrlToUtf8(b64url: string) {
  const base64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false as const, status: 401, error: "Missing Authorization" };
  }

  const token = authHeader.slice(7).trim();
  const parts = token.split(".");
  if (parts.length < 2) return { ok: false as const, status: 401, error: "Invalid token" };

  let payload: { role?: unknown; sub?: unknown };
  try {
    const payloadJson = base64UrlToUtf8(parts[1] ?? "");
    payload = JSON.parse(payloadJson) as { role?: unknown; sub?: unknown };
  } catch {
    return { ok: false as const, status: 401, error: "Invalid token" };
  }

  const role = typeof payload.role === "string" ? payload.role : "";
  if (role !== "authenticated") {
    return { ok: false as const, status: 401, error: "Not authenticated" };
  }

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) return { ok: false as const, status: 401, error: "Invalid token" };

  return { ok: true as const, userId };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = requireAuthenticatedUser(req);
    if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

    const GEMINI_API_KEY =
      Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY") ?? "";

    if (!GEMINI_API_KEY) return json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });

    const body = await req.json().catch(() => null);
    const messagesRaw = parseMessages(isRecord(body) ? body.messages : null);
    const model = normalizeModel(isRecord(body) ? body.model : null);
    const temperature = normalizeTemperature(isRecord(body) ? body.temperature : null);
    const webSearchEnabled = normalizeBoolean(isRecord(body) ? body.web_search : null, true);

    if (!messagesRaw || messagesRaw.length === 0) return json({ error: "Invalid messages" }, { status: 400 });

    let messages = messagesRaw;
    let webSearchMeta: { enabled: boolean; used: boolean; provider: "brave" | "duckduckgo" | "none"; results_count: number } = {
      enabled: webSearchEnabled,
      used: false,
      provider: "none",
      results_count: 0,
    };
    if (webSearchEnabled) {
      const q = lastUserQuery(messagesRaw);
      if (q) {
        const searched = await searchWeb(q, 5);
        const results = searched.results;
        webSearchMeta = {
          enabled: true,
          used: results.length > 0,
          provider: searched.provider,
          results_count: results.length,
        };
        if (results.length > 0) {
          const ctx = formatWebContext(results);
          const trimmed = ctx.length > 6000 ? ctx.slice(0, 6000) : ctx;
          messages = injectWebContext(messagesRaw, trimmed);
        }
      }
    }

    const shopBasePath = Deno.env.get("SHOP_BASE_PATH") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const q = lastUserQuery(messages);
    if (q && shouldInjectProductContext(q) && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const ctx = await buildShopProductContext({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
        query: q,
        shopBasePath,
      }).catch(() => ({ text: "", meta: { used: false, products_count: 0 } }));
      if (ctx.text) {
        const trimmed = ctx.text.length > 6000 ? ctx.text.slice(0, 6000) : ctx.text;
        messages = injectWebContext(messages, trimmed);
      }
    }

    const extracted = extractSystemInstruction(messages);
    const systemText = extracted.systemText;
    const nonSystemMessages = extracted.messages;

    const contents = nonSystemMessages.map((msg) => {
      const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
      parts.push({ text: msg.content });

      if (msg.images && msg.images.length > 0) {
        for (const imgUrl of msg.images) {
          if (imgUrl.startsWith("data:image")) {
            const [header, base64Data] = imgUrl.split(",", 2);
            if (header && base64Data) {
              const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
              parts.push({
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              });
            }
          }
        }
      }

      return {
        role: msg.role === "user" ? "user" : "model",
        parts,
      };
    });

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(systemText ? { system_instruction: { parts: [{ text: systemText }] } } : {}),
        contents,
        generationConfig: { temperature },
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        (isRecord(data) && isRecord(data.error) && typeof data.error.message === "string" && data.error.message) ||
        "Failed to generate content";
      return json({ error: message }, { status: 500 });
    }

    const payload = (isRecord(data) ? { ...data } : { data }) as Record<string, unknown>;
    payload.__web_search = webSearchMeta;
    return json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, { status: 500 });
  }
});
