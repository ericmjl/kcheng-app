import type { NextRequest } from "next/server";
import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { getConvexClient, api } from "@/lib/convex-server";
import {
  isParseableDoc,
  parseDocumentFromDataUrl,
} from "@/lib/parse-document";
import { getUid } from "@/lib/workos-auth";

async function getClaudeKey(uid: string | null): Promise<string | null> {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return fromEnv;
  if (!uid) return null;
  try {
    const client = await getConvexClient(uid);
    const settings = await client.query(api.userSettings.get);
    return (settings?.apiKeys as { anthropic?: string } | undefined)?.anthropic ?? null;
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT_BASE = `You are a helpful assistant for a China trip planner. You create contacts, calendar events, and todos by calling tools. You MUST call the tools—never just describe what you would do in text.

Rules:
- When the user mentions meeting someone (e.g. "meeting with Lee Wei at 3pm", "I have a meeting with Jane on Tuesday at 2pm"): (1) call createContact with the person's name, (2) call createEvent with a title like "Meeting with [Name]", start as ISO 8601 datetime, and optionally location/notes. Always create both the contact and the event.
- When the user says they met someone (e.g. "I just met John from Acme Corp"): call createContact with name and company (and role/notes if mentioned).
- When the user says they want to follow up or have a todo: call createTodo with the task text and optional dueDate (ISO date).
- Use ISO 8601 for all dates/times. When the user says "today", "tomorrow", or gives only a time (e.g. "3pm"), use a date within the trip range (see below).
- After calling tools, briefly confirm what you created.

Uploaded Excel or Word files:
- The user may attach an Excel (.xlsx) or Word (.docx) file. The parsed content will appear in their message as structured text.
- Interpret the content and call createContact, createEvent, and/or createTodo as appropriate. Create one tool call per row or per extracted item.
- Use ISO 8601 for dates/times. All event and todo dates must fall within the user's trip range.

Always call the tools; do not skip tool calls.`;

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

  const apiKey = await getClaudeKey(uid);
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Claude API key not configured. Add in Settings or set ANTHROPIC_API_KEY." }),
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
            const mediaType = p.mediaType ?? "";
            const url = p.url ?? "";
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

  const anthropicProvider = createAnthropic({ apiKey });
  const result = streamText({
    model: anthropicProvider("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      createContact: tool({
        description: "Create a new contact (person met or to meet).",
        inputSchema: z.object({
          name: z.string().describe("Full name of the contact"),
          company: z.string().optional().describe("Company or organization"),
          role: z.string().optional().describe("Job title or role"),
          phone: z.string().optional(),
          email: z.string().optional(),
          notes: z.string().optional(),
        }),
        execute: async ({ name, company, role, phone, email, notes }) => {
          try {
            const doc = await convexClient.mutation(api.contacts.create, {
              name: String(name ?? "").trim(),
              company: company ? String(company).trim() : undefined,
              role: role ? String(role).trim() : undefined,
              phone: phone ? String(phone).trim() : undefined,
              email: email ? String(email).trim() : undefined,
              notes: notes ? String(notes).trim() : undefined,
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
        description: "Create a calendar event (meeting, appointment, etc.). Use ISO 8601 for start/end.",
        inputSchema: z.object({
          title: z.string().describe("Event title (e.g. 'Meeting with Jane')"),
          start: z.string().describe("Start datetime in ISO 8601 format"),
          end: z.string().optional().describe("End datetime in ISO 8601 format"),
          location: z.string().optional(),
          notes: z.string().optional(),
        }),
        execute: async ({ title, start, end, location, notes }) => {
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
            const doc = await convexClient.mutation(api.events.create, {
              title: String(title ?? ""),
              start: startStr,
              end: end ? String(end) : undefined,
              location: location ? String(location) : undefined,
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
        description: "Create a todo or follow-up task.",
        inputSchema: z.object({
          text: z.string().describe("The task or follow-up description"),
          dueDate: z.string().optional().describe("Due date in ISO 8601 date format (YYYY-MM-DD)"),
        }),
        execute: async ({ text, dueDate }) => {
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
