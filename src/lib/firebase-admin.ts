import { getApps, initializeApp, getApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { cert } from "firebase-admin/app";

function normalizePrivateKey(key: string | undefined): string | null {
  if (!key || typeof key !== "string") return null;
  // Strip optional surrounding quotes (some env loaders include them)
  let trimmed = key.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }
  trimmed = trimmed.trim();
  if (!trimmed) return null;
  // Env vars often have literal \n (backslash-n); replace with real newlines for PEM
  const withNewlines = trimmed.replace(/\\n/g, "\n");
  return withNewlines;
}

function getAdminApp(): App | null {
  if (getApps().length) return getApp() as App;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) return null;
  try {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } catch (e) {
    console.error("Firebase Admin init failed (check FIREBASE_PRIVATE_KEY format):", (e as Error).message);
    return null;
  }
}

// Alternative: use default credential (e.g. GOOGLE_APPLICATION_CREDENTIALS or Vercel env)
export function getAdminDb() {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

export function getAdminAuth() {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}

export async function verifyIdToken(token: string): Promise<{ uid: string } | null> {
  const auth = getAdminAuth();
  if (!auth) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}
