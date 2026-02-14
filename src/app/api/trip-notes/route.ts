import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const client = await getConvexClient(uid);
    const list = await client.query(api.tripNotes.list);
    return NextResponse.json(list ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load trip notes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    const contactIds = Array.isArray(body.contactIds)
      ? body.contactIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 50)
      : undefined;
    const eventIds = Array.isArray(body.eventIds)
      ? body.eventIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 50)
      : undefined;
    const client = await getConvexClient(uid);
    const doc = await client.mutation(api.tripNotes.create, {
      content,
      contactIds: contactIds?.length ? contactIds : undefined,
      eventIds: eventIds?.length ? eventIds : undefined,
    });
    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create trip note" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const updates: { content?: string; contactIds?: string[]; eventIds?: string[] } = {};
    if (typeof body.content === "string") updates.content = body.content.trim();
    if (Array.isArray(body.contactIds)) {
      updates.contactIds = body.contactIds
        .filter((x: unknown): x is string => typeof x === "string")
        .slice(0, 50);
    }
    if (Array.isArray(body.eventIds)) {
      updates.eventIds = body.eventIds
        .filter((x: unknown): x is string => typeof x === "string")
        .slice(0, 50);
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "At least one of content, contactIds, eventIds is required" }, { status: 400 });
    }
    const client = await getConvexClient(uid);
    const doc = await client.mutation(api.tripNotes.update, {
      id: id as Id<"tripNotes">,
      ...updates,
    });
    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update trip note" }, { status: 500 });
  }
}
