import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId") ?? undefined;
  try {
    const client = await getConvexClient(uid);
    const list = await client.query(api.dossiers.list, contactId ? { contactId } : {});
    return NextResponse.json(list ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load dossiers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const contactId = String(body.contactId ?? "").trim();
    if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });
    const client = await getConvexClient(uid);
    const doc = await client.mutation(api.dossiers.create, {
      contactId,
      eventId: body.eventId ? String(body.eventId) : undefined,
      transcript: body.transcript ? String(body.transcript) : undefined,
      summary: body.summary ? String(body.summary) : undefined,
      actionItems: Array.isArray(body.actionItems) ? body.actionItems : undefined,
      recordingUrl: body.recordingUrl ? String(body.recordingUrl) : undefined,
    });
    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create dossier" }, { status: 500 });
  }
}
