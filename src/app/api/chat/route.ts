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
    },
  });

  return result.toUIMessageStreamResponse();
}
