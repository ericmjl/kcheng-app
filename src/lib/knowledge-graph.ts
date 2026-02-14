/**
 * Build knowledge graph (nodes + edges) from Convex data.
 * Nodes: contact, event, todo, note. Edges: attended, todo_for, about.
 */

export type GraphNode = {
  id: string;
  type: "contact" | "event" | "todo" | "note";
  label: string;
  [key: string]: unknown;
};

export type GraphEdge = {
  from: string;
  to: string;
  type: "attended" | "todo_for" | "about";
};

export type KnowledgeGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

type ContactDoc = { id: string; name?: string; company?: string };
type EventDoc = { id: string; title?: string; start?: string; contactIds?: string[]; contactId?: string };
type TodoDoc = { id: string; text?: string; done?: boolean; contactIds?: string[] };
type NoteDoc = { id: string; content?: string; contactIds?: string[]; eventIds?: string[] };

export function buildKnowledgeGraph(
  contacts: ContactDoc[],
  events: EventDoc[],
  todos: TodoDoc[],
  notes: NoteDoc[]
): KnowledgeGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const c of contacts) {
    const label = [c.name, c.company].filter(Boolean).join(c.company ? " (" : "").concat(c.company ? ")" : "");
    nodes.push({ id: c.id, type: "contact", label: label || c.id, name: c.name, company: c.company });
  }
  for (const e of events) {
    const label = [e.title, e.start].filter(Boolean).join(" – ") || e.id;
    nodes.push({ id: e.id, type: "event", label, title: e.title, start: e.start });
  }
  for (const t of todos) {
    const label = (t.text ?? "").slice(0, 60) || t.id;
    nodes.push({ id: t.id, type: "todo", label, text: t.text, done: t.done });
  }
  for (const n of notes) {
    const label = (n.content ?? "").slice(0, 60) || n.id;
    nodes.push({ id: n.id, type: "note", label, content: n.content });
  }

  for (const e of events) {
    const contactIds = e.contactIds?.length ? e.contactIds : e.contactId ? [e.contactId] : [];
    for (const cid of contactIds) {
      if (contacts.some((c) => c.id === cid)) edges.push({ from: cid, to: e.id, type: "attended" });
    }
  }
  for (const t of todos) {
    for (const cid of t.contactIds ?? []) {
      if (contacts.some((c) => c.id === cid)) edges.push({ from: cid, to: t.id, type: "todo_for" });
    }
  }
  for (const n of notes) {
    for (const cid of n.contactIds ?? []) {
      if (contacts.some((c) => c.id === cid)) edges.push({ from: n.id, to: cid, type: "about" });
    }
    for (const eid of n.eventIds ?? []) {
      if (events.some((e) => e.id === eid)) edges.push({ from: n.id, to: eid, type: "about" });
    }
  }

  return { nodes, edges };
}

/** Produce a short text summary of the graph for the assistant. */
export function knowledgeGraphToSummary(graph: KnowledgeGraph): string {
  const contacts = graph.nodes.filter((n) => n.type === "contact");
  const events = graph.nodes.filter((n) => n.type === "event");
  const todos = graph.nodes.filter((n) => n.type === "todo" && n.done !== true);
  const attended = graph.edges.filter((e) => e.type === "attended");
  const todoFor = graph.edges.filter((e) => e.type === "todo_for");
  const lines: string[] = [];
  lines.push(`Contacts (${contacts.length}): ${contacts.map((c) => c.label).join("; ") || "none"}`);
  lines.push(`Events (${events.length}): ${events.map((e) => e.label).join("; ") || "none"}`);
  lines.push(`Open todos (${todos.length}): ${todos.map((t) => t.label).join("; ") || "none"}`);
  lines.push(`Meeting links (contact–event): ${attended.length}`);
  lines.push(`Todo–contact links: ${todoFor.length}`);
  return lines.join("\n");
}
