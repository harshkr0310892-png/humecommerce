import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function createGenerateAvatarDevApi(env: Record<string, string>) {
  return {
    name: "generate-avatar-dev-api",
    configureServer(server: any) {
      server.middlewares.use("/api/generate-avatar", async (req: any, res: any, next: any) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing GEMINI_API_KEY" }));
          return;
        }

        const modelUrl =
          env.GEMINI_MODEL_URL ||
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

        let rawBody = "";
        req.on("data", (chunk: any) => {
          rawBody += chunk;
        });
        await new Promise<void>((resolve) => req.on("end", () => resolve()));

        let body: any = null;
        try {
          body = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          body = null;
        }

        const prompt = body?.prompt;
        if (typeof prompt !== "string" || prompt.trim().length < 3) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid prompt" }));
          return;
        }

        try {
          const url = new URL(modelUrl);
          if (!url.searchParams.has("key")) {
            url.searchParams.set("key", apiKey);
          }

          const upstream = await fetch(url.toString(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text:
                        "Generate a single, valid SVG avatar. Output ONLY the SVG markup (no markdown, no explanations). The SVG must be standalone and renderable.\n\nDescription: " +
                        prompt,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                topP: 0.1,
              },
            }),
          });

          const json: any = await upstream.json().catch(() => null);
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: json?.error?.message || json?.error || "Upstream error",
              })
            );
            return;
          }

          const svg = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof svg !== "string" || svg.trim().length < 10) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid response from model" }));
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ svg }));
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: e?.message || "Server error" }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "development" && createGenerateAvatarDevApi(env),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
