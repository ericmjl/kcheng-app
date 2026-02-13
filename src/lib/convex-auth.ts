import { SignJWT, importPKCS8 } from "jose";

const ISSUER = process.env.CONVEX_JWT_ISSUER ?? "https://kcheng-app";
const APPLICATION_ID = process.env.CONVEX_JWT_APPLICATION_ID ?? "kcheng-app";
const EXPIRY_SEC = 60 * 60; // 1 hour

/**
 * Sign a Convex custom JWT for the given user id (WorkOS user id).
 * Requires CONVEX_JWT_PRIVATE_KEY (PEM, RS256) and optionally CONVEX_JWT_ISSUER, CONVEX_JWT_APPLICATION_ID.
 * Used by /api/convex-token and by getConvexClient for server-side Convex calls.
 */
export async function signConvexToken(userId: string): Promise<string> {
  const keyPem = process.env.CONVEX_JWT_PRIVATE_KEY;
  if (!keyPem) {
    throw new Error("CONVEX_JWT_PRIVATE_KEY is not set. Add your RS256 private key (PEM) for Convex custom JWT.");
  }
  const pem = keyPem.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "kcheng-app-1" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(APPLICATION_ID)
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .setExpirationTime(Math.floor(Date.now() / 1000) + EXPIRY_SEC)
    .sign(key);
  return jwt;
}
