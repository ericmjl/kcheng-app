import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { buildKnowledgeGraph } from "./knowledge-graph";
import { buildSummaryInputFromGraph, type TripSummaryData } from "./trip-summary-graph";

/**
 * Load trip data and generate a 1–2 paragraph narrative summary via OpenAI.
 * Walks the knowledge graph (by contact), peeks into each entity, then one LLM call for the narrative.
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

  const contactsList = (contacts ?? []).map(
    (c: { id?: string; _id?: string; name?: string; company?: string; role?: string; notes?: string; displaySummary?: string; researchSummary?: string; eventIds?: string[] }) => ({
      id: String(c.id ?? c._id ?? ""),
      name: c.name,
      company: c.company,
      role: c.role,
      notes: c.notes,
      displaySummary: c.displaySummary,
      researchSummary: c.researchSummary,
      eventIds: c.eventIds,
    })
  );
  const eventsList = (events ?? []).map(
    (e: {
      id?: string;
      _id?: string;
      title?: string;
      start?: string;
      end?: string;
      location?: string;
      notes?: string;
      contactIds?: string[];
      contactId?: string;
    }) => ({
      id: String(e.id ?? e._id ?? ""),
      title: e.title,
      start: e.start,
      end: e.end,
      location: e.location,
      notes: e.notes,
      contactIds: e.contactIds ?? (e.contactId ? [e.contactId] : []),
      contactId: e.contactId,
    })
  );
  const todosList = (todos ?? []).map(
    (t: { id?: string; _id?: string; text?: string; done?: boolean; dueDate?: string; contactIds?: string[] }) => ({
      id: String(t.id ?? t._id ?? ""),
      text: t.text,
      done: t.done,
      dueDate: t.dueDate,
      contactIds: t.contactIds,
    })
  );
  const notesList = (tripNotes ?? []).map(
    (n: { id?: string; _id?: string; content?: string; createdAt?: string; contactIds?: string[]; eventIds?: string[] }) => ({
      id: String(n.id ?? n._id ?? ""),
      content: n.content,
      createdAt: n.createdAt,
      contactIds: n.contactIds,
      eventIds: n.eventIds,
    })
  );
  const dossiersList = (dossiers ?? []).map(
    (d: { id?: string; _id?: string; contactId?: string; eventId?: string; summary?: string; actionItems?: string[] }) => ({
      id: String(d.id ?? d._id ?? ""),
      contactId: d.contactId,
      eventId: d.eventId,
      summary: d.summary,
      actionItems: d.actionItems,
    })
  );

  const graph = buildKnowledgeGraph(contactsList, eventsList, todosList, notesList);
  const data: TripSummaryData = {
    contacts: contactsList,
    events: eventsList,
    todos: todosList,
    tripNotes: notesList,
    dossiers: dossiersList,
  };

  const dataBlob =
    graph.nodes.length > 0
      ? buildSummaryInputFromGraph(graph, data, "byContact")
      : (() => {
          const sections: string[] = [];
          if (contactsList.length)
            sections.push(
              `Contacts: ${contactsList.map((c) => [c.name, c.company, c.role].filter(Boolean).join(", ")).join("; ")}`
            );
          if (eventsList.length)
            sections.push(
              `Events: ${eventsList.map((e) => `${e.title ?? ""} (${e.start ?? ""})${e.location ? ` at ${e.location}` : ""}`).join("; ")}`
            );
          const openTodos = todosList.filter((t) => !t.done);
          if (openTodos.length)
            sections.push(
              `Open todos: ${openTodos.map((t) => (t.dueDate ? `${t.text ?? ""} (due ${t.dueDate})` : t.text ?? "")).join("; ")}`
            );
          const dossierSumms = dossiersList.filter((d) => d.summary).map((d) => d.summary);
          if (dossierSumms.length) sections.push(`Meeting summaries: ${dossierSumms.join(" | ")}`);
          if (notesList.length)
            sections.push(`Trip notes: ${notesList.map((n) => `[${n.createdAt ?? ""}] ${n.content ?? ""}`).join(" | ")}`);
          return sections.length ? sections.join("\n\n") : "No contacts, events, todos, or notes yet.";
        })();

  const prompt = `You are summarizing the user's China trip for them. Use only the information below. Trip date range: ${tripRange}.

Data (from knowledge graph walk and entity peeks):
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
