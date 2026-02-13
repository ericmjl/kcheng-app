import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";
import { generateDisplaySummary } from "@/lib/generate-display-summary";

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
    if (body.pronouns !== undefined) updates.pronouns = body.pronouns ? String(body.pronouns).trim() : "";
    if (body.photoUrl !== undefined) updates.photoUrl = body.photoUrl ? String(body.photoUrl).trim() : undefined;
    if (body.linkedInUrl !== undefined) updates.linkedInUrl = body.linkedInUrl ? String(body.linkedInUrl).trim() : undefined;
    if (body.researchSummary !== undefined) updates.researchSummary = body.researchSummary ? String(body.researchSummary).trim() : undefined;
    if (body.researchTaskId !== undefined) updates.researchTaskId = body.researchTaskId ? String(body.researchTaskId).trim() : undefined;
    if (body.researchTaskStatus !== undefined) updates.researchTaskStatus = body.researchTaskStatus ? String(body.researchTaskStatus).trim() : undefined;
    if (Array.isArray(body.eventIds)) updates.eventIds = body.eventIds;

    const client = await getConvexClient(uid);
    let doc = await client.mutation(api.contacts.update, {
      id: (await params).id as any,
      ...updates,
    });
    if (doc?.name) {
      const displaySummary = await generateDisplaySummary(uid, {
        name: doc.name,
        company: doc.company,
        role: doc.role,
        notes: doc.notes,
        linkedInUrl: doc.linkedInUrl,
        researchSummary: doc.researchSummary,
      });
      if (displaySummary) {
        doc = await client.mutation(api.contacts.update, {
          id: (await params).id as any,
          displaySummary,
        });
      }
    }
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
