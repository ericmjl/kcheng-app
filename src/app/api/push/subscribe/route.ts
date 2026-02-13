import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getUid } from "@/lib/workos-auth";

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const body = await request.json();
    const subscription = body.subscription;
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    await db.collection("userSettings").doc(uid).collection("pushSubscriptions").doc(subscription.endpoint).set({
      subscription,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}
