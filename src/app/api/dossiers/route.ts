import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminDb } from "@/lib/firebase-admin";
import type { MeetingDossier } from "@/lib/types";

async function getUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  return decoded?.uid ?? null;
}

function dossiersRef(uid: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("dossiers");
}

function toDossier(id: string, data: Record<string, unknown>): MeetingDossier {
  return {
    id,
    contactId: (data.contactId as string) ?? "",
    eventId: data.eventId as string | undefined,
    transcript: data.transcript as string | undefined,
    summary: data.summary as string | undefined,
    actionItems: Array.isArray(data.actionItems) ? (data.actionItems as string[]) : undefined,
    recordingUrl: data.recordingUrl as string | undefined,
    createdAt: (data.createdAt as string) ?? "",
    updatedAt: (data.updatedAt as string) ?? "",
  };
}

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = dossiersRef(uid);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId");
  try {
    const snap = await ref.get();
    let dossiers = snap.docs.map((d) => toDossier(d.id, d.data() as Record<string, unknown>));
    if (contactId) dossiers = dossiers.filter((d) => d.contactId === contactId);
    dossiers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(dossiers);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load dossiers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = dossiersRef(uid);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const body = await request.json();
    const contactId = String(body.contactId ?? "").trim();
    if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });
    const now = new Date().toISOString();
    const doc = {
      contactId,
      eventId: body.eventId ? String(body.eventId) : null,
      transcript: body.transcript ? String(body.transcript) : null,
      summary: body.summary ? String(body.summary) : null,
      actionItems: Array.isArray(body.actionItems) ? body.actionItems : null,
      recordingUrl: body.recordingUrl ? String(body.recordingUrl) : null,
      createdAt: now,
      updatedAt: now,
    };
    const res = await ref.add(doc);
    return NextResponse.json({ id: res.id, ...doc });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create dossier" }, { status: 500 });
  }
}
