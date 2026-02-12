import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminDb } from "@/lib/firebase-admin";
import type { UserSettingsDoc } from "@/lib/types";

const SETTINGS_COLLECTION = "userSettings";

async function getUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  return decoded?.uid ?? null;
}

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server not configured for persistence" },
      { status: 503 }
    );
  }
  try {
    const doc = await db.collection(SETTINGS_COLLECTION).doc(uid).get();
    const data = doc.data() as UserSettingsDoc | undefined;
    const defaults: UserSettingsDoc = {
      tripStart: "",
      tripEnd: "",
      timezone: "Asia/Shanghai",
    };
    return NextResponse.json({ ...defaults, ...data });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server not configured for persistence" },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const updates: Partial<UserSettingsDoc> = {};
    if (typeof body.tripStart === "string") updates.tripStart = body.tripStart;
    if (typeof body.tripEnd === "string") updates.tripEnd = body.tripEnd;
    if (typeof body.timezone === "string") updates.timezone = body.timezone;
    if (body.apiKeys && typeof body.apiKeys === "object") {
      updates.apiKeys = {
        anthropic: body.apiKeys.anthropic ?? undefined,
        openai: body.apiKeys.openai ?? undefined,
        finnhub: body.apiKeys.finnhub ?? undefined,
      };
    }
    if (Array.isArray(body.savedPlaces)) updates.savedPlaces = body.savedPlaces;
    await db.collection(SETTINGS_COLLECTION).doc(uid).set(updates, {
      merge: true,
    });
    const doc = await db.collection(SETTINGS_COLLECTION).doc(uid).get();
    return NextResponse.json(doc.data());
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
