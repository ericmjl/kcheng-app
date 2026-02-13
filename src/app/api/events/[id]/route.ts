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
    const doc = await client.query(api.events.get, { id: (await params).id as any });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load event" }, { status: 500 });
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
    const id = (await params).id;
    const args: { id: string; title?: string; start?: string; end?: string; location?: string; contactIds?: string[]; notes?: string } = { id };
    if (body.title !== undefined) args.title = String(body.title);
    if (body.start !== undefined) args.start = String(body.start);
    if (body.end !== undefined) args.end = body.end ? String(body.end) : undefined;
    if (body.location !== undefined) args.location = body.location ? String(body.location) : undefined;
    if (body.contactIds !== undefined) {
      args.contactIds = Array.isArray(body.contactIds)
        ? body.contactIds.filter((id): id is string => typeof id === "string").slice(0, 50)
        : [];
    } else if (body.contactId !== undefined) {
      args.contactIds = body.contactId ? [String(body.contactId)] : [];
    }
    if (body.notes !== undefined) args.notes = body.notes ? String(body.notes) : undefined;
    const client = await getConvexClient(uid);
    const doc = await client.mutation(api.events.update, args as any);
    return NextResponse.json(doc);
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
  try {
    const client = await getConvexClient(uid);
    await client.mutation(api.events.remove, { id: (await params).id as any });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
