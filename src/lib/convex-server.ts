import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { signConvexToken } from "./convex-auth";

let client: ConvexHttpClient | null = null;

function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL or CONVEX_URL is not set. Run `npx convex dev` and add the URL to .env.local.");
  }
  return url;
}

/**
 * Get an authenticated Convex HTTP client for the given user id.
 * Use in API routes: get uid from getUid(request), then call getConvexClient(uid) and run queries/mutations.
 */
export async function getConvexClient(uid: string): Promise<ConvexHttpClient> {
  const url = getConvexUrl();
  if (!client) client = new ConvexHttpClient(url);
  const token = await signConvexToken(uid);
  client.setAuth(token);
  return client;
}

export { api };
