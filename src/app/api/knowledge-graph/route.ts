import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";
import { buildKnowledgeGraph } from "@/lib/knowledge-graph";

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const client = await getConvexClient(uid);
    const [contacts, events, todos, tripNotes] = await Promise.all([
      client.query(api.contacts.list),
      client.query(api.events.list),
      client.query(api.todos.list),
      client.query(api.tripNotes.list),
    ]);

    const contactsList = (contacts ?? []).map((c: { _id?: string; id?: string; name?: string; company?: string }) => ({
      id: (c.id ?? c._id ?? "").toString(),
      name: c.name,
      company: c.company,
    }));
    const eventsList = (events ?? []).map((e: { _id?: string; id?: string; title?: string; start?: string; contactIds?: string[]; contactId?: string }) => ({
      id: (e.id ?? e._id ?? "").toString(),
      title: e.title,
      start: e.start,
      contactIds: e.contactIds ?? (e.contactId ? [e.contactId] : []),
      contactId: e.contactId,
    }));
    const todosList = (todos ?? []).map((t: { _id?: string; id?: string; text?: string; done?: boolean; contactIds?: string[] }) => ({
      id: (t.id ?? t._id ?? "").toString(),
      text: t.text,
      done: t.done,
      contactIds: t.contactIds,
    }));
    const notesList = (tripNotes ?? []).map((n: { _id?: string; id?: string; content?: string; contactIds?: string[]; eventIds?: string[] }) => ({
      id: (n.id ?? n._id ?? "").toString(),
      content: n.content,
      contactIds: n.contactIds,
      eventIds: n.eventIds,
    }));

    const graph = buildKnowledgeGraph(contactsList, eventsList, todosList, notesList);
    return NextResponse.json(graph);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to build knowledge graph" },
      { status: 500 }
    );
  }
}
