import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";
import { getOpenAIKey } from "@/lib/llm-keys";
import OpenAI from "openai";

function formatEventForPrompt(ev: { title?: string; start?: string; end?: string; location?: string; notes?: string }): string {
  const parts: string[] = [];
  if (ev.title) parts.push(`Title: ${ev.title}`);
  if (ev.start) parts.push(`When: ${new Date(ev.start).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`);
  if (ev.location) parts.push(`Where: ${ev.location}`);
  if (ev.notes) parts.push(`Agenda / notes: ${ev.notes}`);
  return parts.join("\n");
}

const CONVERSATION_PROMPT = (contactName: string, company: string, researchSummary: string, meetingContext: string, trendsSummary: string) =>
  `You are helping someone prepare for a business or networking meeting in China.

Contact name: ${contactName}
Company: ${company}
${researchSummary ? `\nBackground research on this person:\n${researchSummary}\n` : ""}
${meetingContext ? `\n${meetingContext}\n` : ""}
Recent company context (profile and news):
${typeof trendsSummary === "string" ? trendsSummary : JSON.stringify(trendsSummary)}

Generate exactly 5 short, intelligent conversation starters or questions they can use when meeting this person. Use the upcoming meeting and agenda when provided to make questions relevant to that context; otherwise focus on recent company news, industry trends, and thoughtful business questions. Keep each to 1-2 sentences. Output as a JSON array of strings, e.g. ["Question 1?", "Question 2?", ...]. No other text.`;

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const openaiKey = await getOpenAIKey(uid);
  if (!openaiKey) {
    return NextResponse.json(
      { error: "Add an OpenAI API key in Settings or set OPENAI_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const contactName = String(body.contactName ?? "").trim();
    const company = String(body.company ?? "").trim();
    let trendsSummary = body.trendsSummary ?? "";
    const contactId = typeof body.contactId === "string" ? body.contactId.trim() : undefined;

    let researchSummary = "";
    let meetingContext = "";

    if (contactId) {
      const client = await getConvexClient(uid);
      const contact = await client.query(api.contacts.get, { id: contactId as any });
      if (contact?.researchSummary) researchSummary = contact.researchSummary;

      const allEvents = await client.query(api.events.list);
      const now = new Date().toISOString();
      const upcoming = (allEvents ?? [])
        .filter((e: { contactId?: string; start?: string }) => e.contactId === contactId && (e.start ?? "") >= now)
        .sort((a: { start?: string }, b: { start?: string }) => (a.start ?? "").localeCompare(b.start ?? ""))
        .slice(0, 5);
      if (upcoming.length > 0) {
        meetingContext = "Upcoming meeting(s) with this contact:\n\n" + upcoming.map((ev: Record<string, unknown>) => formatEventForPrompt(ev)).join("\n\n---\n\n");
      }
    }

    const prompt = CONVERSATION_PROMPT(contactName, company, researchSummary, meetingContext, trendsSummary);
    let text = "";

    const openai = new OpenAI({ apiKey: openaiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    text = completion.choices[0]?.message?.content ?? "";

    let questions: string[] = [];
    try {
      const parsed = JSON.parse(text.trim());
      questions = Array.isArray(parsed)
        ? parsed.filter((q) => typeof q === "string").slice(0, 5)
        : [];
    } catch {
      questions = text.split(/\n/).filter((l) => l.trim().length > 0).slice(0, 5);
    }
    return NextResponse.json({ questions });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to generate conversation starters" },
      { status: 500 }
    );
  }
}
