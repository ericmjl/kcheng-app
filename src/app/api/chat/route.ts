import { NextRequest } from "next/server";
import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { verifyIdToken, getAdminDb } from "@/lib/firebase-admin";

async function getUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  return decoded?.uid ?? null;
}

async function getClaudeKey(uid: string | null): Promise<string | null> {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return fromEnv;
  if (!uid) return null;
  const db = getAdminDb();
  if (!db) return null;
  const doc = await db.collection("userSettings").doc(uid).get();
  const data = doc.data();
  return (data?.apiKeys as { anthropic?: string } | undefined)?.anthropic ?? null;
}

function contactsRef(uid: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("contacts");
}

function eventsRef(uid: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("events");
}

function todosRef(uid: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection("userSettings").doc(uid).collection("todos");
}

const systemPrompt = `You are a helpful assistant for a China trip planner. You can create contacts, calendar events, and todos from natural language.

- When the user says they met someone (e.g. "I just met John from Acme Corp"), use createContact with name and company (and role/notes if mentioned).
- When the user says they are meeting someone or have an appointment (e.g. "I'm meeting Jane on Tuesday at 3pm at the hotel"), use createEvent with title, start (ISO datetime), and optionally location and notes.
- When the user says they want to follow up or have a todo (e.g. "I need to follow up with John on the proposal"), use createTodo with the task text and optional dueDate (ISO date).

Use relative dates based on today when the user says "next Tuesday", "tomorrow", etc. Prefer being helpful: infer missing fields when reasonable and confirm what you did in a short reply.`;

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

  const contacts = contactsRef(uid);
  const events = eventsRef(uid);
  const todos = todosRef(uid);
  if (!contacts || !events || !todos) {
    return new Response(
      JSON.stringify({ error: "Server not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { messages?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawMessages = (Array.isArray(body?.messages) ? body.messages : []) as Array<Omit<UIMessage, "id">>;
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
          const now = new Date().toISOString();
          const doc = {
            name: String(name ?? "").trim(),
            company: company ? String(company).trim() : null,
            role: role ? String(role).trim() : null,
            phone: phone ? String(phone).trim() : null,
            email: email ? String(email).trim() : null,
            stockTicker: null,
            notes: notes ? String(notes).trim() : null,
            eventIds: [],
            createdAt: now,
            updatedAt: now,
          };
          const res = await contacts.add(doc);
          return { id: res.id, ...doc };
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
          const now = new Date().toISOString();
          const doc = {
            title: String(title ?? ""),
            start: String(start ?? now),
            end: end ? String(end) : null,
            location: location ? String(location) : null,
            contactId: null,
            notes: notes ? String(notes) : null,
            createdAt: now,
            updatedAt: now,
          };
          const res = await events.add(doc);
          return { id: res.id, ...doc };
        },
      }),
      createTodo: tool({
        description: "Create a todo or follow-up task.",
        inputSchema: z.object({
          text: z.string().describe("The task or follow-up description"),
          dueDate: z.string().optional().describe("Due date in ISO 8601 date format (YYYY-MM-DD)"),
        }),
        execute: async ({ text, dueDate }) => {
          const now = new Date().toISOString();
          const doc = {
            text: String(text ?? "").trim(),
            done: false,
            dueDate: dueDate ? String(dueDate) : null,
            createdAt: now,
            updatedAt: now,
          };
          const res = await todos.add(doc);
          return { id: res.id, ...doc };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
