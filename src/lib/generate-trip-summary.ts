import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/**
 * Load trip data and generate a 1–2 paragraph narrative summary via OpenAI.
 * Used by POST /api/trip-summary and by the chat generateTripSummary tool.
 */
export async function generateTripSummaryContent(
  convexClient: ConvexHttpClient,
  openaiKey: string
): Promise<string> {
  const [settings, contacts, events, todos, dossiers, tripNotes] = await Promise.all([
    convexClient.query(api.userSettings.get),
    convexClient.query(api.contacts.list),
    convexClient.query(api.events.list),
    convexClient.query(api.todos.list),
    convexClient.query(api.dossiers.list, {}),
    convexClient.query(api.tripNotes.list),
  ]);

  const tripStart = (settings?.tripStart ?? "").trim();
  const tripEnd = (settings?.tripEnd ?? "").trim();
  const tripRange = tripStart && tripEnd ? `${tripStart} to ${tripEnd}` : "not set";

  const contactList = (contacts ?? []).map((c: { name?: string; company?: string; role?: string }) =>
    [c.name, c.company, c.role].filter(Boolean).join(", ")
  );
  const eventList = (events ?? []).map(
    (e: { title?: string; start?: string; location?: string; contactIds?: string[] }) =>
      `${e.title ?? ""} (${e.start ?? ""})${e.location ? ` at ${e.location}` : ""}`
  );
  const todoList = (todos ?? []).filter((t: { done?: boolean }) => !t.done).map((t: { text?: string; dueDate?: string }) =>
    t.dueDate ? `${t.text ?? ""} (due ${t.dueDate})` : (t.text ?? "")
  );
  const dossierSummaries = (dossiers ?? [])
    .filter((d: { summary?: string }) => d.summary)
    .map((d: { summary?: string }) => d.summary);
  const noteContents = (tripNotes ?? []).map((n: { content?: string; createdAt?: string }) =>
    `[${n.createdAt ?? ""}] ${n.content ?? ""}`
  );

  const sections: string[] = [];
  if (contactList.length) sections.push(`Contacts: ${contactList.join("; ")}`);
  if (eventList.length) sections.push(`Events: ${eventList.join("; ")}`);
  if (todoList.length) sections.push(`Open todos: ${todoList.join("; ")}`);
  if (dossierSummaries.length) sections.push(`Meeting summaries: ${dossierSummaries.join(" | ")}`);
  if (noteContents.length) sections.push(`Trip notes: ${noteContents.join(" | ")}`);

  const dataBlob = sections.length ? sections.join("\n\n") : "No contacts, events, todos, or notes yet.";
  const prompt = `You are summarizing the user's China trip for them. Use only the information below. Trip date range: ${tripRange}.

Data:
${dataBlob}

Write a concise narrative summary in 1–2 short paragraphs: who they are meeting or met, main events, key follow-ups or todos, and any highlights from their notes. Use a friendly, first-person or second-person tone. Output only the summary, no heading.`;

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: openaiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  return text || "No summary generated.";
}
