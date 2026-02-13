import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";
import { generateDisplaySummary } from "@/lib/generate-display-summary";

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const client = await getConvexClient(uid);
    const list = await client.query(api.contacts.list);
    return NextResponse.json(list ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const client = await getConvexClient(uid);
    let doc = await client.mutation(api.contacts.create, {
      name: String(body.name ?? "").trim(),
      company: body.company ? String(body.company).trim() : undefined,
      role: body.role ? String(body.role).trim() : undefined,
      phone: body.phone ? String(body.phone).trim() : undefined,
      email: body.email ? String(body.email).trim() : undefined,
      stockTicker: body.stockTicker ? String(body.stockTicker).trim() : undefined,
      notes: body.notes ? String(body.notes).trim() : undefined,
      pronouns: body.pronouns ? String(body.pronouns).trim() : undefined,
      eventIds: Array.isArray(body.eventIds) ? body.eventIds : undefined,
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
          id: doc.id,
          displaySummary,
        });
      }
    }
    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
