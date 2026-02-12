import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Contact } from "@/lib/types";

async function getUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  return decoded?.uid ?? null;
}

function contactRef(uid: string, contactId: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("contacts").doc(contactId);
}

function toContact(id: string, data: Record<string, unknown>): Contact {
  return {
    id,
    name: (data.name as string) ?? "",
    company: data.company as string | undefined,
    role: data.role as string | undefined,
    phone: data.phone as string | undefined,
    email: data.email as string | undefined,
    stockTicker: data.stockTicker as string | undefined,
    notes: data.notes as string | undefined,
    eventIds: Array.isArray(data.eventIds) ? (data.eventIds as string[]) : [],
    createdAt: (data.createdAt as string) ?? "",
    updatedAt: (data.updatedAt as string) ?? "",
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = contactRef(uid, (await params).id);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toContact(ref.id, snap.data()!));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load contact" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = contactRef(uid, (await params).id);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.company !== undefined) updates.company = body.company ? String(body.company).trim() : null;
    if (body.role !== undefined) updates.role = body.role ? String(body.role).trim() : null;
    if (body.phone !== undefined) updates.phone = body.phone ? String(body.phone).trim() : null;
    if (body.email !== undefined) updates.email = body.email ? String(body.email).trim() : null;
    if (body.stockTicker !== undefined) updates.stockTicker = body.stockTicker ? String(body.stockTicker).trim() : null;
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : null;
    if (Array.isArray(body.eventIds)) updates.eventIds = body.eventIds;
    await ref.update(updates);
    const snap = await ref.get();
    return NextResponse.json(toContact(ref.id, { ...snap.data(), ...updates }));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = contactRef(uid, (await params).id);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}
