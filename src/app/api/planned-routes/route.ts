import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminDb } from "@/lib/firebase-admin";
import type { PlannedRoute } from "@/lib/types";

async function getUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  return decoded?.uid ?? null;
}

function routesRef(uid: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("plannedRoutes");
}

function toRoute(id: string, data: Record<string, unknown>): PlannedRoute {
  return {
    id,
    from: (data.from as string) ?? "",
    to: (data.to as string) ?? "",
    date: (data.date as string) ?? "",
    notes: data.notes as string | undefined,
    createdAt: (data.createdAt as string) ?? "",
    updatedAt: (data.updatedAt as string) ?? "",
  };
}

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = routesRef(uid);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const snap = await ref.get();
    const routes = snap.docs
      .map((d) => toRoute(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return NextResponse.json(routes);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load routes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = routesRef(uid);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const body = await request.json();
    const from = String(body.from ?? "").trim();
    const to = String(body.to ?? "").trim();
    const date = String(body.date ?? "").trim();
    if (!from || !to || !date) {
      return NextResponse.json({ error: "from, to, and date required" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const doc = {
      from,
      to,
      date,
      notes: body.notes ? String(body.notes).trim() : null,
      createdAt: now,
      updatedAt: now,
    };
    const res = await ref.add(doc);
    return NextResponse.json({ id: res.id, ...doc });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create route" }, { status: 500 });
  }
}
