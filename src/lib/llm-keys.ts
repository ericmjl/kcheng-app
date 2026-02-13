import { getConvexClient, api } from "@/lib/convex-server";

/**
 * OpenAI key for chat, conversation starters, and meeting summaries.
 * Read from env (OPENAI_API_KEY) first, then from user settings.
 */
export async function getOpenAIKey(uid: string | null): Promise<string | null> {
  const fromEnv = process.env.OPENAI_API_KEY;
  if (fromEnv?.trim()) return fromEnv.trim();
  if (!uid) return null;
  try {
    const client = await getConvexClient(uid);
    const settings = await client.query(api.userSettings.get);
    return (settings?.apiKeys as { openai?: string } | undefined)?.openai?.trim() ?? null;
  } catch {
    return null;
  }
}

