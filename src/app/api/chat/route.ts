import type { NextRequest } from "next/server";
import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getConvexClient, api } from "@/lib/convex-server";
import {
  isParseableDoc,
  parseDocumentFromDataUrl,
} from "@/lib/parse-document";
import { getUid } from "@/lib/workos-auth";
import { getOpenAIKey } from "@/lib/llm-keys";
import { generateTripSummaryContent } from "@/lib/generate-trip-summary";
import { buildKnowledgeGraph, knowledgeGraphToSummary } from "@/lib/knowledge-graph";
import type { Id } from "../../../../convex/_generated/dataModel";

const SYSTEM_PROMPT_BASE = `You are a helpful assistant for a China trip planner. You create contacts, calendar events, and todos by calling tools. You MUST call the tools—never just describe what you would do in text.

RESOLVED CONTACTS (user tagged someone with @ from their contact list): If the user's message ends with a line like "[Resolved contacts - use these ids directly, do not ask to confirm: Name1 (id: id1), Name2 (id: id2).]" then the user has already selected these contacts. You MUST use those exact contact ids (id1, id2, etc.) when creating events or todos. Do NOT call findContactsByName for those names. Do NOT ask "which contact?" or show disambiguation—just use the given ids (e.g. contactIds: [id1] or [id1, id2]) and create the event or todo in one step.

Rules for MEETINGS (e.g. "meeting with Lee Wei at 3pm", "I have a meeting with Jane on Tuesday at 2pm"):
- If the message includes resolved contact ids (see above), use them directly and call createEvent with contactIds: [those ids]. Do not ask to confirm.
- Otherwise: FIRST call findContactsByName with the person's name (the name they mentioned).
- If findContactsByName returns one or more contacts: Do NOT call createContact. Reply in one short sentence that you found existing contacts and the user can click one below or say "Create new contact". Do not create any contact or event yet—wait for the user to choose.
- If the user then replies with a contact choice (e.g. "Use contact Yan Kou" or "Use contact Yan Kou (GSK)"): call findContactsByName with the person's name to get the contact id, then call createEvent with contactIds: [that id] and the event details. If the message includes a company in parentheses, use it to pick the right contact when there are multiple matches. Do not call createContact.
- If the user says "create new contact" or "new" or "create new": then call createContact and createEvent with contactIds: [the new contact's id].
- If the user mentions multiple people for one meeting (e.g. "meeting with Jane and Bob at 3pm"): find or create each contact, then call createEvent with contactIds: [id1, id2, ...].
- If findContactsByName returns zero contacts: call createContact then createEvent as usual (no disambiguation).

Rules for "I met someone" (no meeting time): call createContact only. If the message includes resolved contact ids, the contact already exists—do nothing (or use the id if creating a todo). Otherwise: First call findContactsByName; if matches exist, ask the user to pick one or say "create new". If they pick, do nothing (contact already exists). If they say create new or no matches, call createContact.

Rules for todos: call createTodo with the task text and optional dueDate (ISO date).
- Use ISO 8601 for all dates/times. When the user says "today", "tomorrow", or gives only a time (e.g. "3pm"), use a date within the trip range (see below).
- After calling tools, briefly confirm what you created.

Uploaded Excel or Word files:
- The user may attach an Excel (.xlsx) or Word (.docx) file. The parsed content will appear in their message as structured text.
- Interpret the content and call createContact, createEvent, and/or createTodo as appropriate. Create one tool call per row or per extracted item.
- Use ISO 8601 for dates/times. All event and todo dates must fall within the user's trip range.

Photos and images:
- The user may attach a photo (e.g. a business card, contact screenshot, or image containing contact details). You can see the image content.
- When a photo clearly shows contact information (name, and optionally company, role, phone, email, etc.), extract the details and call createContact immediately. Do not ask for confirmation—create the contact. Use title case for name, company, and role (e.g. "John Smith", not "JOHN SMITH"). If multiple people appear in one image, call createContact for each.
- If the image does not contain contact information, say so briefly and do not create a contact.

Notes (continual note-taking):
- When the user is clearly jotting a note (e.g. "Note: ...", "Remember ...", "Just a note: ...") or shares a standalone thought with no meeting, contact, or todo intent, call saveNote with the content. Optionally include contactIds or eventIds if they @-mentioned contacts or referred to a specific event. Do not create events, contacts, or todos for pure notes. Confirm briefly that you saved the note.

Brain dump / long notes (e.g. "here are my notes", "brain dump", "process these notes", or a long pasted block):
- Treat the message as raw notes to parse. Extract: (1) people/contacts (names, optionally company), (2) meetings/events (with date, time, and who is attending), (3) todos/follow-ups (task + optional due date and who it's for).
- For each person mentioned: call findContactsByName with the name. If 0 matches: call createContact (with company if given), then use the new id. If 1 match: use that id. If 2+ matches: do NOT guess. Reply with one short question: "Which [Name] is this: [Option1 (Company1)], [Option2 (Company2)]? Or say 'create new' for a new contact." Wait for the user's reply before creating any event/todo/note that uses that person. When they pick, use that contact id; if they say "create new", call createContact and use the new id.
- For each meeting: determine date/time (use trip range and date reference) and attendees. Resolve attendees using the rule above (disambiguate if multiple contacts). Then call createEvent with title, start (ISO 8601), and contactIds.
- For each todo: call createTodo with text and optional dueDate; if the todo is clearly for a specific person, include contactIds after resolving (disambiguate if needed).
- After creating contacts, events, and todos, call saveNote with the note content (or a short summary of the dump) and pass contactIds and eventIds for all entities this note is about—so the note is linked in the knowledge graph. You may save one note for the whole dump or split into multiple notes per topic; when in doubt, one note with the full content and all relevant contactIds and eventIds.
- If anything is ambiguous (same name, "the meeting tomorrow" when there are several, "send to John" with multiple Johns), ask one clear disambiguation question before creating or linking. Do not guess. One question at a time if there are multiple ambiguities.

Linking notes to contacts/events:
- When the user asks to "link this note to [person/event]", "attach this note to Jane", or "associate the note about X with the Lunch meeting", use updateNoteLinks with the note id and the resolved contactIds and/or eventIds. First identify which note (e.g. from context or the list they see). If the person or event is ambiguous (multiple matches), ask which one before calling the tool.
- Notes are first-class in the knowledge graph: linking a note to contacts and events creates "about" edges so the graph shows what each note refers to.

Trip summary: When the user asks to "summarize my trip", "give me a trip summary", or similar, call generateTripSummary. It generates a narrative from their contacts, events, todos, meeting notes, and trip notes, saves it, and returns it. Show them the summary and say you have saved it.

Knowledge graph: When the user asks who they are meeting, what follow-ups they have for someone, or how contacts/events/todos are connected, call getKnowledgeGraph to get an overview of contacts, events, todos, and their links. Use it to answer questions about the trip structure.

Always call the tools when appropriate; do not skip tool calls.`;

/** Returns YYYY-MM-DD from an ISO date or datetime string. */
function datePart(iso: string): string {
  return iso.slice(0, 10);
}

/** True if the date part of iso is within [tripStart, tripEnd] (inclusive). */
function isWithinTripRange(iso: string, tripStart: string, tripEnd: string): boolean {
  const d = datePart(iso);
  return tripStart <= d && d <= tripEnd;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Build a short date reference so the model maps "this Saturday" etc. to the correct date. */
function buildDateReference(): string {
  const today = new Date();
  const lines: string[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const weekday = WEEKDAY_NAMES[d.getDay()];
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `In ${i} days`;
    lines.push(`${label}: ${weekday}, ${y}-${m}-${day}`);
  }
  return lines.join(". ");
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const openaiKey = await getOpenAIKey(uid);
  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: "Add an OpenAI API key in Settings or set OPENAI_API_KEY." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const convexClient = await getConvexClient(uid);

  const settings = await convexClient.query(api.userSettings.get);
  const tripStart = (settings?.tripStart ?? "").trim();
  const tripEnd = (settings?.tripEnd ?? "").trim();
  const hasTripRange = tripStart && tripEnd && tripStart <= tripEnd;

  const tripRangeInstruction = hasTripRange
    ? `\n\nTRIP DATE RANGE (you must respect this): The user's trip is from ${tripStart} to ${tripEnd}. You MUST only create calendar events and todo due dates that fall within this range. When the user says "today", "tomorrow", or gives only a time (e.g. "3pm"), interpret as a date within this trip—e.g. use the first day of the trip for "today" or when only time is given. Never use dates outside ${tripStart}–${tripEnd}.`
    : "\n\nTRIP DATE RANGE: The user has not set trip start/end in Settings. Do not create events or todos with specific dates until they set a trip range; you can still create contacts and undated todos.";

  const dateRef = buildDateReference();
  const dateInstruction = `\n\nCURRENT DATE REFERENCE (use this to map weekdays to dates correctly): ${dateRef}. When the user says "this Saturday", "Saturday", "this Sunday", etc., use the YYYY-MM-DD that is actually that weekday—e.g. if Saturday is 2026-02-14 then "this Saturday" must be 2026-02-14, not 2026-02-15. Double-check the weekday name matches the date.`;

  const systemPrompt = SYSTEM_PROMPT_BASE + tripRangeInstruction + dateInstruction;

  let body: { messages?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let rawMessages = (Array.isArray(body?.messages) ? body.messages : []) as Array<Omit<UIMessage, "id">>;

  // Preprocess: parse Excel/Word file parts into text so the model can create contacts/events/todos
  rawMessages = await Promise.all(
    rawMessages.map(async (msg) => {
      if (msg.role !== "user" || !Array.isArray(msg.parts)) return msg;
      const newParts = await Promise.all(
        msg.parts.map(async (part) => {
          if (
            typeof part === "object" &&
            part !== null &&
            (part as { type?: string }).type === "file"
          ) {
            const p = part as { mediaType?: string; url?: string };
            const mediaType = (p.mediaType ?? "").toLowerCase();
            const url = p.url ?? "";
            // Leave image parts as-is so the vision model receives them
            if (mediaType.startsWith("image/")) return part;
            if (isParseableDoc(mediaType) && url.startsWith("data:")) {
              const parsed = await parseDocumentFromDataUrl(url, mediaType);
              if (parsed) {
                const label = parsed.kind === "excel" ? "Spreadsheet content" : "Document content";
                return {
                  type: "text" as const,
                  text: `[${label} from uploaded file]\n\n${parsed.text}`,
                };
              }
            }
          }
          return part;
        })
      );
      return { ...msg, parts: newParts };
    })
  );

  const modelMessages = await convertToModelMessages(rawMessages);

  const model = createOpenAI({ apiKey: openaiKey })("gpt-4o");

  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      findContactsByName: tool({
        description: "Search existing contacts by name. Call this before creating a new contact or meeting so we can avoid duplicates. Returns contacts whose name contains the query (case-insensitive).",
        inputSchema: z.object({
          name: z.string().describe("Person's name or part of it to search for"),
        }),
        execute: async ({ name }) => {
          try {
            const list = await convexClient.query(api.contacts.list);
            const query = String(name ?? "").trim().toLowerCase();
            if (!query) return { contacts: [] };
            const contacts = (list ?? []).filter(
              (c) => c.name?.toLowerCase().includes(query)
            );
            return {
              contacts: contacts.slice(0, 10).map((c) => ({
                id: c.id,
                name: c.name,
                company: c.company ?? undefined,
              })),
            };
          } catch (e) {
            console.error("[chat] findContactsByName error", e);
            return { contacts: [] };
          }
        },
      }),
      createContact: tool({
        description:
          "Create a new contact (person met or to meet). Use when the user shares contact info in text or in a photo (e.g. business card). Use title case for name, company, role.",
        inputSchema: z.object({
          name: z.string().describe("Full name of the contact"),
          company: z.string().optional().describe("Company or organization"),
          role: z.string().optional().describe("Job title or role"),
          phone: z.string().optional(),
          email: z.string().optional(),
          notes: z.string().optional(),
          stockTicker: z.string().optional().describe("Company stock ticker if relevant"),
          pronouns: z.string().optional(),
        }),
        execute: async ({
          name,
          company,
          role,
          phone,
          email,
          notes,
          stockTicker,
          pronouns,
        }) => {
          try {
            const doc = await convexClient.mutation(api.contacts.create, {
              name: String(name ?? "").trim(),
              company: company ? String(company).trim() : undefined,
              role: role ? String(role).trim() : undefined,
              phone: phone ? String(phone).trim() : undefined,
              email: email ? String(email).trim() : undefined,
              notes: notes ? String(notes).trim() : undefined,
              stockTicker: stockTicker ? String(stockTicker).trim() : undefined,
              pronouns: pronouns ? String(pronouns).trim() : undefined,
            });
            console.log("[chat] createContact ok:", name, doc?._id);
            return doc ?? { id: "", name: String(name ?? "").trim() };
          } catch (e) {
            console.error("[chat] createContact error:", name, e);
            throw e;
          }
        },
      }),
      createEvent: tool({
        description: "Create a calendar event (meeting, appointment). Use ISO 8601 for start/end. Pass contactIds (array of contact ids) when linking to one or more existing contacts.",
        inputSchema: z.object({
          title: z.string().describe("Event title (e.g. 'Meeting with Jane')"),
          start: z.string().describe("Start datetime in ISO 8601 format"),
          end: z.string().optional().describe("End datetime in ISO 8601 format"),
          location: z.string().optional(),
          notes: z.string().optional(),
          contactIds: z.array(z.string()).optional().describe("Contact ids for people in this meeting (from findContactsByName or createContact)"),
        }),
        execute: async ({ title, start, end, location, notes, contactIds }) => {
          try {
            if (!hasTripRange) {
              const err = new Error(
                "The user has not set a trip date range in Settings. Ask them to set trip start and end in Settings so events can be created within that range."
              );
              console.warn("[chat] createEvent rejected (no trip range)");
              throw err;
            }
            const startStr = String(start ?? new Date().toISOString());
            if (!isWithinTripRange(startStr, tripStart, tripEnd)) {
              const err = new Error(
                `Event date ${datePart(startStr)} is outside the trip range (${tripStart}–${tripEnd}). Use a date within that range.`
              );
              console.warn("[chat] createEvent rejected (out of range):", title, startStr);
              throw err;
            }
            if (end && !isWithinTripRange(end, tripStart, tripEnd)) {
              const err = new Error(
                `Event end date ${datePart(end)} is outside the trip range (${tripStart}–${tripEnd}). Use a date within that range.`
              );
              console.warn("[chat] createEvent rejected (end out of range):", title, end);
              throw err;
            }
            const ids = Array.isArray(contactIds) ? contactIds.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()) : [];
            const doc = await convexClient.mutation(api.events.create, {
              title: String(title ?? ""),
              start: startStr,
              end: end ? String(end) : undefined,
              location: location ? String(location) : undefined,
              contactIds: ids.length ? ids : undefined,
              notes: notes ? String(notes) : undefined,
            });
            console.log("[chat] createEvent ok:", title, startStr, doc?._id);
            return doc ?? { id: "", title: String(title ?? ""), start: startStr };
          } catch (e) {
            console.error("[chat] createEvent error:", title, e);
            throw e;
          }
        },
      }),
      createTodo: tool({
        description: "Create a todo or follow-up task. Pass contactIds when the user @-mentioned specific contacts.",
        inputSchema: z.object({
          text: z.string().describe("The task or follow-up description"),
          dueDate: z.string().optional().describe("Due date in ISO 8601 date format (YYYY-MM-DD)"),
          contactIds: z.array(z.string()).optional().describe("Contact ids when the user tagged someone with @ (from resolved contacts in the message)"),
        }),
        execute: async ({ text, dueDate, contactIds }) => {
          try {
            if (dueDate) {
              if (!hasTripRange) {
                const err = new Error(
                  "The user has not set a trip date range in Settings. Create the todo without a due date, or ask them to set trip start and end in Settings."
                );
                console.warn("[chat] createTodo rejected (no trip range, has dueDate)");
                throw err;
              }
              if (!isWithinTripRange(dueDate, tripStart, tripEnd)) {
                const err = new Error(
                  `Todo due date ${datePart(dueDate)} is outside the trip range (${tripStart}–${tripEnd}). Use a date within that range.`
                );
                console.warn("[chat] createTodo rejected (out of range):", text.slice(0, 40), dueDate);
                throw err;
              }
            }
            const doc = await convexClient.mutation(api.todos.create, {
              text: String(text ?? "").trim(),
              dueDate: dueDate ? String(dueDate) : undefined,
              contactIds: contactIds?.length ? contactIds : undefined,
            });
            console.log("[chat] createTodo ok:", text.slice(0, 40), doc?._id);
            return doc ?? { id: "", text: String(text ?? "").trim(), done: false };
          } catch (e) {
            console.error("[chat] createTodo error:", text.slice(0, 40), e);
            throw e;
          }
        },
      }),
      saveNote: tool({
        description: "Save a freeform trip note (e.g. 'Note: ...', 'Remember ...', or a standalone thought). Use when the user is jotting something down with no meeting/todo/contact intent. Optionally link to contacts or events if they @-mentioned them.",
        inputSchema: z.object({
          content: z.string().describe("The note text to save"),
          contactIds: z.array(z.string()).optional().describe("Contact ids if the note is about specific people (from @-mentions or resolved contacts)"),
          eventIds: z.array(z.string()).optional().describe("Event ids if the note is about a specific meeting or event"),
        }),
        execute: async ({ content, contactIds, eventIds }) => {
          try {
            const doc = await convexClient.mutation(api.tripNotes.create, {
              content: String(content ?? "").trim(),
              contactIds: contactIds?.length ? contactIds : undefined,
              eventIds: eventIds?.length ? eventIds : undefined,
            });
            console.log("[chat] saveNote ok:", doc?._id);
            return doc ?? { id: "", content: String(content ?? "").trim() };
          } catch (e) {
            console.error("[chat] saveNote error:", e);
            throw e;
          }
        },
      }),
      updateNoteLinks: tool({
        description: "Link an existing trip note to contacts and/or events (for the knowledge graph). Use when the user says to link a note to a person or meeting, e.g. 'link this note to Jane', 'associate the note with the Lunch event'. Pass the note id and the resolved contactIds and/or eventIds.",
        inputSchema: z.object({
          noteId: z.string().describe("The trip note id to update"),
          contactIds: z.array(z.string()).optional().describe("Contact ids to link this note to (replaces existing; from findContactsByName)"),
          eventIds: z.array(z.string()).optional().describe("Event ids to link this note to (replaces existing)"),
        }),
        execute: async ({ noteId, contactIds, eventIds }) => {
          try {
            const doc = await convexClient.mutation(api.tripNotes.update, {
              id: noteId as Id<"tripNotes">,
              ...(contactIds !== undefined && { contactIds: contactIds?.length ? contactIds : undefined }),
              ...(eventIds !== undefined && { eventIds: eventIds?.length ? eventIds : undefined }),
            });
            console.log("[chat] updateNoteLinks ok:", noteId);
            return doc ?? { id: noteId, updated: true };
          } catch (e) {
            console.error("[chat] updateNoteLinks error:", e);
            throw e;
          }
        },
      }),
      generateTripSummary: tool({
        description: "Generate a narrative trip summary from the user's contacts, events, todos, meeting dossiers, and trip notes. Call when the user asks to summarize their trip or for a trip summary. Saves the summary and returns it.",
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const summary = await generateTripSummaryContent(convexClient, openaiKey);
            const now = new Date().toISOString();
            await convexClient.mutation(api.userSettings.set, {
              tripSummary: summary,
              tripSummaryUpdatedAt: now,
            });
            console.log("[chat] generateTripSummary ok");
            return { summary, saved: true };
          } catch (e) {
            console.error("[chat] generateTripSummary error:", e);
            throw e;
          }
        },
      }),
      getKnowledgeGraph: tool({
        description: "Get an overview of the user's trip knowledge graph: contacts, events, todos, and how they are linked (who attends which event, which todos are for which contact). Call when the user asks who they are meeting, what follow-ups they have, or how things connect.",
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const [contacts, events, todos, tripNotes] = await Promise.all([
              convexClient.query(api.contacts.list),
              convexClient.query(api.events.list),
              convexClient.query(api.todos.list),
              convexClient.query(api.tripNotes.list),
            ]);
            const contactsList = (contacts ?? []).map((c: { id?: string; _id?: string; name?: string; company?: string }) => ({
              id: String(c.id ?? c._id ?? ""),
              name: c.name,
              company: c.company,
            }));
            const eventsList = (events ?? []).map((e: { id?: string; _id?: string; title?: string; start?: string; contactIds?: string[]; contactId?: string }) => ({
              id: String(e.id ?? e._id ?? ""),
              title: e.title,
              start: e.start,
              contactIds: e.contactIds ?? (e.contactId ? [e.contactId] : []),
              contactId: e.contactId,
            }));
            const todosList = (todos ?? []).map((t: { id?: string; _id?: string; text?: string; done?: boolean; contactIds?: string[] }) => ({
              id: String(t.id ?? t._id ?? ""),
              text: t.text,
              done: t.done,
              contactIds: t.contactIds,
            }));
            const notesList = (tripNotes ?? []).map((n: { id?: string; _id?: string; content?: string; contactIds?: string[]; eventIds?: string[] }) => ({
              id: String(n.id ?? n._id ?? ""),
              content: n.content,
              contactIds: n.contactIds,
              eventIds: n.eventIds,
            }));
            const graph = buildKnowledgeGraph(contactsList, eventsList, todosList, notesList);
            const summary = knowledgeGraphToSummary(graph);
            return { summary, nodeCount: graph.nodes.length, edgeCount: graph.edges.length };
          } catch (e) {
            console.error("[chat] getKnowledgeGraph error:", e);
            throw e;
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
