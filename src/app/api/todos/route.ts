import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Todo } from "@/lib/types";

async function getUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  return decoded?.uid ?? null;
}

function todosRef(uid: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("todos");
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

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = todosRef(uid);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const snap = await ref.get();
    const todos: Todo[] = snap.docs
      .map((d) => toTodo(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json(todos);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load todos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ref = todosRef(uid);
  if (!ref) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const doc = {
      text: String(body.text ?? "").trim(),
      done: Boolean(body.done),
      dueDate: body.dueDate ? String(body.dueDate) : null,
      createdAt: now,
      updatedAt: now,
    };
    const res = await ref.add(doc);
    return NextResponse.json({ id: res.id, ...doc });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create todo" }, { status: 500 });
  }
}
