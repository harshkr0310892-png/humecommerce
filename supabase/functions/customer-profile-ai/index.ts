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

    const contents = messages.map((msg) => {
      const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
      parts.push({ text: msg.content });

      // Handle multiple images
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
