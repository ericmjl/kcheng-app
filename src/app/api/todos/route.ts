import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const client = await getConvexClient(uid);
    const list = await client.query(api.todos.list);
    return NextResponse.json(list ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load todos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const contactIds = Array.isArray(body.contactIds)
      ? (body.contactIds as string[]).filter((id): id is string => typeof id === "string").slice(0, 50)
      : undefined;
    const client = await getConvexClient(uid);
    const doc = await client.mutation(api.todos.create, {
      text: String(body.text ?? "").trim(),
      done: typeof body.done === "boolean" ? body.done : undefined,
      dueDate: body.dueDate ? String(body.dueDate) : undefined,
      contactIds: contactIds?.length ? contactIds : undefined,
    });
    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create todo" }, { status: 500 });
  }
}
