import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { unsealData } from "iron-session";
import { withAuth } from "@workos-inc/authkit-nextjs";
import type { User } from "@workos-inc/node";

const COOKIE_NAME = process.env.WORKOS_COOKIE_NAME || "wos-session";
const COOKIE_PASSWORD = process.env.WORKOS_COOKIE_PASSWORD || "";

interface SealedSession {
  user?: User | null;
}

/**
 * Read session from the WorkOS cookie (same format as AuthKit).
 * Used when the AuthKit proxy/middleware is not running (e.g. API routes in Next 16).
 */
async function getSessionFromRequest(request: NextRequest): Promise<SealedSession | null> {
  if (!COOKIE_PASSWORD || COOKIE_PASSWORD.length < 32) return null;
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  try {
    return (await unsealData(cookie.value, { password: COOKIE_PASSWORD })) as SealedSession | null;
  } catch {
    return null;
  }
}

/**
 * Get initial auth from the session cookie in server components (e.g. root layout).
 * Use as initialAuth for AuthKitProvider so it skips the initial getAuthAction() call,
 * which requires middleware headers that Next.js 16 often does not forward.
 * See: https://github.com/workos/authkit-nextjs/issues/351
 */
export async function getInitialAuth(): Promise<{ user: User | null }> {
  if (!COOKIE_PASSWORD || COOKIE_PASSWORD.length < 32) return { user: null };
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return { user: null };
  try {
    const session = (await unsealData(cookie.value, {
      password: COOKIE_PASSWORD,
    })) as SealedSession | null;
    return { user: session?.user ?? null };
  } catch {
    return { user: null };
  }
}

/**
 * Returns the current user's WorkOS id for use as uid in Firestore paths.
 *
 * - In API route handlers: pass the request so we read the session from the
 *   cookie (works without AuthKit proxy/middleware).
 * - In server components: call getUid() with no args; requires AuthKit proxy
 *   to run on the route so withAuth() can read session from headers.
 */
export async function getUid(request?: NextRequest): Promise<string | null> {
  if (request) {
    const session = await getSessionFromRequest(request);
    return session?.user?.id ?? null;
  }
  const { user } = await withAuth();
  return user?.id ?? null;
}
