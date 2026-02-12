import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Event } from "@/lib/types";

async function getUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  return decoded?.uid ?? null;
}

function eventsRef(uid: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("events");
}

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = eventsRef(uid);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const snap = await ref.orderBy("start").get();
    const events: Event[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title ?? "",
        start: data.start,
        end: data.end,
        location: data.location,
        contactId: data.contactId,
        notes: data.notes,
        createdAt: data.createdAt ?? "",
        updatedAt: data.updatedAt ?? "",
      };
    });
    return NextResponse.json(events);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = eventsRef(uid);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const doc = {
      title: String(body.title ?? ""),
      start: String(body.start ?? now),
      end: body.end ? String(body.end) : null,
      location: body.location ? String(body.location) : null,
      contactId: body.contactId ?? null,
      notes: body.notes ? String(body.notes) : null,
      createdAt: now,
      updatedAt: now,
    };
    const res = await ref.add(doc);
    return NextResponse.json({ id: res.id, ...doc });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
