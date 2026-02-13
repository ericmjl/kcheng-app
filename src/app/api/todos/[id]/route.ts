import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const id = (await params).id;
    const args: { id: string; text?: string; done?: boolean; dueDate?: string; contactIds?: string[] } = { id };
    if (body.text !== undefined) args.text = String(body.text).trim();
    if (typeof body.done === "boolean") args.done = body.done;
    if (body.dueDate !== undefined) args.dueDate = body.dueDate ? String(body.dueDate) : undefined;
    if (body.contactIds !== undefined) {
      args.contactIds = Array.isArray(body.contactIds)
        ? (body.contactIds as string[]).filter((id): id is string => typeof id === "string").slice(0, 50)
        : [];
    }
    const client = await getConvexClient(uid);
    const doc = await client.mutation(api.todos.update, args as any);
    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update todo" }, { status: 500 });
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
    await client.mutation(api.todos.remove, { id: (await params).id as any });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete todo" }, { status: 500 });
  }
}
