import { supabase } from "@/integrations/supabase/client";

class GeminiService {
  async generateContent(
    messages: Array<{ role: string; content: string; imageUrl?: string }>,
    model: string = 'gemini-2.5-flash',
    temperature: number = 0.1
  ) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      let accessToken = session.access_token;
      if (typeof session.expires_at === "number" && session.expires_at * 1000 < Date.now() + 60_000) {
        const refreshed = await supabase.auth.refreshSession().catch(() => null);
        accessToken = refreshed?.data?.session?.access_token ?? accessToken;
      }

      const { data, error } = await supabase.functions.invoke("customer-profile-ai", {
        body: { messages, model, temperature },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        const ctx = (error as unknown as { context?: Response } | null)?.context;
        const statusPart = ctx ? ` (${ctx.status})` : "";
        const bodyText = ctx ? await ctx.clone().text().catch(() => "") : "";
        const bodyPart = bodyText.trim() ? `: ${bodyText}` : "";
        throw new Error((error.message || "AI request failed") + statusPart + bodyPart);
      }

      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }

      return data;
    } catch (error) {
      console.error('Error with Gemini API:', error);
      throw error;
    }
  }
}

export default GeminiService;
