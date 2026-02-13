import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { withAuth } from "@workos-inc/authkit-nextjs";
import type { User } from "@workos-inc/node";

const COOKIE_NAME = process.env.WORKOS_COOKIE_NAME || "wos-session";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;

export interface SessionData {
  user: User;
  accessToken: string;
  refreshToken: string;
  impersonator?: { email: string; reason: string | null };
}

function getCookiePassword(): string {
  return process.env.WORKOS_COOKIE_PASSWORD || "";
}

function getEncryptionKey(): Buffer {
  const password = getCookiePassword();
  if (!password || password.length < 32) {
    throw new Error("WORKOS_COOKIE_PASSWORD must be at least 32 characters");
  }
  return createHash("sha256").update(password).digest();
}

/**
 * Encrypt session for the cookie. Uses Node crypto (AES-256-GCM), not iron-session.
 * Call from the callback route so we control the password at request time.
 */
export function encryptSessionForCookie(session: SessionData): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LEN });
  const json = JSON.stringify(session);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

/**
 * Decrypt session from cookie value. Uses Node crypto, not iron-session.
 * Reads WORKOS_COOKIE_PASSWORD at call time.
 */
export function decryptSessionFromCookie(payload: string): SessionData | null {
  const password = getCookiePassword();
  if (!password || password.length < 32) return null;
  try {
    const key = getEncryptionKey();
    const buf = Buffer.from(payload, "base64url");
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const encrypted = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LEN });
    decipher.setAuthTag(authTag);
    const json = decipher.update(encrypted) + decipher.final("utf8");
    return JSON.parse(json) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Read session from the WorkOS cookie (our encrypted format).
 * Used when the AuthKit proxy/middleware is not running (e.g. API routes in Next 16).
 */
async function getSessionFromRequest(request: NextRequest): Promise<SessionData | null> {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return decryptSessionFromCookie(cookie.value);
}

/**
 * Get initial auth from the session cookie in server components (e.g. root layout).
 * Use as initialAuth for AuthKitProvider so it skips the initial getAuthAction() call.
 */
export async function getInitialAuth(): Promise<{ user: User | null }> {
  const password = getCookiePassword();
  if (!password || password.length < 32) return { user: null };
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return { user: null };
  const session = decryptSessionFromCookie(cookie.value);
  return { user: session?.user ?? null };
}

/**
 * Returns the current user's WorkOS id for use as uid in Firestore paths.
 */
export async function getUid(request?: NextRequest): Promise<string | null> {
  if (request) {
    const session = await getSessionFromRequest(request);
    return session?.user?.id ?? null;
  }
  const { user } = await withAuth();
  return user?.id ?? null;
}

/**
 * Cookie options for the session cookie (same semantics as AuthKit: path, httpOnly, sameSite, maxAge, secure).
 */
export function getSessionCookieOptions(redirectUri?: string | null): {
  path: string;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  maxAge: number;
  secure: boolean;
} {
  const maxAge = 60 * 60 * 24 * 400; // 400 days
  let secure = true;
  if (redirectUri) {
    try {
      const url = new URL(redirectUri);
      secure = url.protocol === "https:";
    } catch {
      // ignore
    }
  }
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge,
    secure,
  };
}
