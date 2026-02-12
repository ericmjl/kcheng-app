import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminDb } from "@/lib/firebase-admin";

async function getUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  return decoded?.uid ?? null;
}

function eventRef(uid: string, eventId: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("events").doc(eventId);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = eventRef(uid, (await params).id);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.title !== undefined) updates.title = String(body.title);
    if (body.start !== undefined) updates.start = String(body.start);
    if (body.end !== undefined) updates.end = body.end ? String(body.end) : null;
    if (body.location !== undefined) updates.location = body.location ? String(body.location) : null;
    if (body.contactId !== undefined) updates.contactId = body.contactId ?? null;
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes) : null;
    await ref.update(updates);
    const snap = await ref.get();
    const data = snap.data();
    return NextResponse.json({
      id: ref.id,
      ...data,
      updatedAt: updates.updatedAt,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = eventRef(uid, (await params).id);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
