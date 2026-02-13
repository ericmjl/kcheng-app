import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const client = await getConvexClient(uid);
    const list = await client.query(api.plannedRoutes.list);
    return NextResponse.json(list ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load routes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const from = String(body.from ?? "").trim();
    const to = String(body.to ?? "").trim();
    const date = String(body.date ?? "").trim();
    if (!from || !to || !date) {
      return NextResponse.json({ error: "from, to, and date required" }, { status: 400 });
    }
    const client = await getConvexClient(uid);
    const doc = await client.mutation(api.plannedRoutes.create, {
      from,
      to,
      date,
      notes: body.notes ? String(body.notes).trim() : undefined,
    });
    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create route" }, { status: 500 });
  }
}
