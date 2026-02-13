import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const client = await getConvexClient(uid);
    const doc = await client.query(api.contacts.get, { id: (await params).id as any });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(doc);
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
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.company !== undefined) updates.company = body.company ? String(body.company).trim() : undefined;
    if (body.role !== undefined) updates.role = body.role ? String(body.role).trim() : undefined;
    if (body.phone !== undefined) updates.phone = body.phone ? String(body.phone).trim() : undefined;
    if (body.email !== undefined) updates.email = body.email ? String(body.email).trim() : undefined;
    if (body.stockTicker !== undefined) updates.stockTicker = body.stockTicker ? String(body.stockTicker).trim() : undefined;
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : undefined;
    if (Array.isArray(body.eventIds)) updates.eventIds = body.eventIds;

    const client = await getConvexClient(uid);
    const doc = await client.mutation(api.contacts.update, {
      id: (await params).id as any,
      ...updates,
    });
    return NextResponse.json(doc);
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
  try {
    const client = await getConvexClient(uid);
    await client.mutation(api.contacts.remove, { id: (await params).id as any });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}
