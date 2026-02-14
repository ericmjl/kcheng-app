import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";
import { exaSearch } from "@/lib/exa";

/**
 * POST /api/contacts/[id]/enrich
 * Search for this contact on LinkedIn (name + company). Returns candidate profile URLs.
 * Uses Exa search with category "people" (optimized for LinkedIn). Requires EXA_API_KEY.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const client = await getConvexClient(uid);
    const contact = await client.query(api.contacts.get, {
      id: (await params).id as any,
    });
    if (!contact)
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const name = contact.name?.trim();
    const company = contact.company?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Contact needs at least a name to search" },
        { status: 400 }
      );
    }

    const query = company ? `${name} ${company}` : name;
    const results = await exaSearch(query, {
      category: "people",
      numResults: 8,
      type: "auto",
    });
    const candidates = results
      .filter((r) => r.url.includes("linkedin.com/in/"))
      .map((r) => ({
        title: r.title,
        link: r.url,
        summary: r.summary,
      }));

    return NextResponse.json({ candidates });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Enrich failed";
    if (message.includes("EXA_API_KEY"))
      return NextResponse.json(
        { error: "Search is not configured. Add EXA_API_KEY in Vercel (and WorkOS env)." },
        { status: 503 }
      );
    console.error("[contacts/enrich]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
