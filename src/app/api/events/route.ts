import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const client = await getConvexClient(uid);
    const list = await client.query(api.events.list);
    return NextResponse.json(list ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const client = await getConvexClient(uid);
    const contactIds = Array.isArray(body.contactIds)
      ? body.contactIds.filter((id): id is string => typeof id === "string").slice(0, 50)
      : body.contactId
        ? [String(body.contactId)]
        : undefined;
    const doc = await client.mutation(api.events.create, {
      title: String(body.title ?? ""),
      start: String(body.start ?? now),
      end: body.end ? String(body.end) : undefined,
      location: body.location ? String(body.location) : undefined,
      contactIds: contactIds?.length ? contactIds : undefined,
      notes: body.notes ? String(body.notes) : undefined,
    });
    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
