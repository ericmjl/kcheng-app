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

function contactsRef(uid: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("contacts");
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

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = contactsRef(uid);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const snap = await ref.get();
    const contacts: Contact[] = snap.docs
      .map((d) => toContact(d.id, d.data()))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    return NextResponse.json(contacts);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = contactsRef(uid);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const doc = {
      name: String(body.name ?? "").trim(),
      company: body.company ? String(body.company).trim() : null,
      role: body.role ? String(body.role).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      email: body.email ? String(body.email).trim() : null,
      stockTicker: body.stockTicker ? String(body.stockTicker).trim() : null,
      notes: body.notes ? String(body.notes).trim() : null,
      eventIds: Array.isArray(body.eventIds) ? body.eventIds : [],
      createdAt: now,
      updatedAt: now,
    };
    const res = await ref.add(doc);
    return NextResponse.json({ id: res.id, ...doc });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
