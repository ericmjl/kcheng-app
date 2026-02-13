import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";
import { exaResearchCreate, exaResearchGet } from "@/lib/exa";

/**
 * POST /api/contacts/[id]/research
 * Fire-and-forget: create Exa research task, save task id on contact, return immediately.
 * Client polls GET .../research/status to pick up the result when done.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const contactId = (await params).id as string;
    const client = await getConvexClient(uid);
    const contact = await client.query(api.contacts.get, { id: contactId as any });
    if (!contact)
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const name = contact.name?.trim();
    const company = contact.company?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Contact needs at least a name to research" },
        { status: 400 }
      );
    }

    if (contact.researchTaskId) {
      return NextResponse.json(
        { error: "Research already in progress for this contact" },
        { status: 409 }
      );
    }

    const pronounInstruction = contact.pronouns?.trim()
      ? `When referring to this person, use only these pronouns: ${contact.pronouns.trim()}. Do not assume or use other pronouns.`
      : `When referring to this person, use they/them pronouns or their name. Do not assume gender or use gendered pronouns (e.g. he/she) unless they appear in a direct quote from a source.`;

    const instructions = `Research this person for a contact profile summary.

Name: ${name}${company ? `\nCompany/organization: ${company}` : ""}

Find and synthesize publicly available information about them: professional role and background, career history, expertise, notable work, and any other relevant public information. Focus on information that would help someone prepare for a meeting or conversation.

Output a clear markdown report of 2–5 short paragraphs. Use only verified information from your search; do not invent facts. If you find very little, say so briefly.

${pronounInstruction}`;

    const { researchId } = await exaResearchCreate(instructions, {
      model: "exa-research",
    });

    await client.mutation(api.contacts.update, {
      id: contactId as any,
      researchTaskId: researchId,
      researchTaskStatus: "running",
      researchSummary: "",
    });

    const updated = await client.query(api.contacts.get, { id: contactId as any });
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Research failed";
    if (message.includes("EXA_API_KEY"))
      return NextResponse.json(
        { error: "Research is not configured. Add EXA_API_KEY." },
        { status: 503 }
      );
    console.error("[contacts/research]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
