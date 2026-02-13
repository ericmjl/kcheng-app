import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getUid } from "@/lib/workos-auth";
import type { Todo } from "@/lib/types";

function todoRef(uid: string, todoId: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("todos").doc(todoId);
}

function toTodo(id: string, data: Record<string, unknown>): Todo {
  return {
    id,
    text: (data.text as string) ?? "",
    done: Boolean(data.done),
    dueDate: data.dueDate as string | undefined,
    createdAt: (data.createdAt as string) ?? "",
    updatedAt: (data.updatedAt as string) ?? "",
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = todoRef(uid, (await params).id);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.text !== undefined) updates.text = String(body.text).trim();
    if (typeof body.done === "boolean") updates.done = body.done;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? String(body.dueDate) : null;
    await ref.update(updates);
    const snap = await ref.get();
    const data = snap.data() as Record<string, unknown>;
    return NextResponse.json(toTodo(ref.id, { ...data, ...updates }));
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
  const ref = todoRef(uid, (await params).id);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete todo" }, { status: 500 });
  }
}
