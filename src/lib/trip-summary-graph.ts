/**
 * Graph-walk + entity peeks for trip summary.
 * Builds a structured blob from the knowledge graph by walking (e.g. by contact)
 * and "peeking" into each entity (full Convex data, template-formatted).
 */

import type { KnowledgeGraph, GraphNode, GraphEdge } from "./knowledge-graph";

export type WalkStep = {
  nodeId: string;
  nodeType: "contact" | "event" | "todo" | "note";
  edgeContext: string;
  /** Contact id when step was emitted under "walk by contact" (for grouping in blob). */
  contactId?: string;
};

/** Full doc shapes from Convex list queries (fields needed for peeks). */
export type TripSummaryData = {
  contacts: Array<{
    id: string;
    name?: string;
    company?: string;
    role?: string;
    notes?: string;
    displaySummary?: string;
    researchSummary?: string;
    eventIds?: string[];
  }>;
  events: Array<{
    id: string;
    title?: string;
    start?: string;
    end?: string;
    location?: string;
    notes?: string;
    contactIds?: string[];
    contactId?: string;
  }>;
  todos: Array<{
    id: string;
    text?: string;
    done?: boolean;
    dueDate?: string;
    contactIds?: string[];
  }>;
  tripNotes: Array<{
    id: string;
    content?: string;
    createdAt?: string;
    contactIds?: string[];
    eventIds?: string[];
  }>;
  dossiers: Array<{
    id: string;
    contactId?: string;
    eventId?: string;
    summary?: string;
    actionItems?: string[];
  }>;
};

const MAX_CONTACTS_IN_WALK = 20;
const MAX_NODES_TOTAL = 80;

/** Count edges touching a node (in + out). */
function edgeCount(nodeId: string, edges: GraphEdge[]): number {
  return edges.filter((e) => e.from === nodeId || e.to === nodeId).length;
}

/**
 * Deterministic walk: by contact. For each contact (sorted by edge count, cap at 20),
 * emit the contact then its attended events, todo_for todos, and notes about them.
 */
export function walkGraphByContact(graph: KnowledgeGraph): WalkStep[] {
  const steps: WalkStep[] = [];
  const contactNodes = graph.nodes.filter((n) => n.type === "contact");
  const attended = graph.edges.filter((e) => e.type === "attended");
  const todoFor = graph.edges.filter((e) => e.type === "todo_for");
  const aboutToContact = graph.edges.filter((e) => e.type === "about" && graph.nodes.find((n) => n.id === e.to && n.type === "contact"));

  const contactIdsByEdgeCount = [...contactNodes]
    .sort((a, b) => edgeCount(b.id, graph.edges) - edgeCount(a.id, graph.edges))
    .slice(0, MAX_CONTACTS_IN_WALK)
    .map((n) => n.id);

  const seenNodeIds = new Set<string>();

  for (const cid of contactIdsByEdgeCount) {
    if (steps.length >= MAX_NODES_TOTAL) break;
    const contactNode = graph.nodes.find((n) => n.id === cid && n.type === "contact");
    if (!contactNode) continue;

    const contactLabel = contactNode.label;
    if (!seenNodeIds.has(cid)) {
      seenNodeIds.add(cid);
      const eventsAttended = attended.filter((e) => e.from === cid).map((e) => e.to);
      const todosFor = todoFor.filter((e) => e.from === cid).map((e) => e.to);
      const notesAbout = aboutToContact.filter((e) => e.to === cid).map((e) => e.from);
      steps.push({
        nodeId: cid,
        nodeType: "contact",
        edgeContext: `attends ${eventsAttended.length} event(s); ${todosFor.length} todo(s) for them; ${notesAbout.length} note(s) about them`,
        contactId: cid,
      });
    }

    const eventIds = attended.filter((e) => e.from === cid).map((e) => e.to);
    for (const eid of eventIds) {
      if (steps.length >= MAX_NODES_TOTAL) break;
      if (seenNodeIds.has(eid)) continue;
      seenNodeIds.add(eid);
      const node = graph.nodes.find((n) => n.id === eid);
      steps.push({
        nodeId: eid,
        nodeType: "event",
        edgeContext: `attended by ${contactLabel}`,
        contactId: cid,
      });
    }

    const todoIds = todoFor.filter((e) => e.from === cid).map((e) => e.to);
    for (const tid of todoIds) {
      if (steps.length >= MAX_NODES_TOTAL) break;
      if (seenNodeIds.has(tid)) continue;
      seenNodeIds.add(tid);
      steps.push({
        nodeId: tid,
        nodeType: "todo",
        edgeContext: `for ${contactLabel}`,
        contactId: cid,
      });
    }

    const noteIds = aboutToContact.filter((e) => e.to === cid).map((e) => e.from);
    for (const nid of noteIds) {
      if (steps.length >= MAX_NODES_TOTAL) break;
      if (seenNodeIds.has(nid)) continue;
      seenNodeIds.add(nid);
      steps.push({
        nodeId: nid,
        nodeType: "note",
        edgeContext: `about ${contactLabel}`,
        contactId: cid,
      });
    }
  }

  const orphanEventIds = graph.nodes
    .filter((n) => n.type === "event" && !seenNodeIds.has(n.id))
    .map((n) => n.id);
  const orphanTodoIds = graph.nodes
    .filter((n) => n.type === "todo" && n.done !== true && !seenNodeIds.has(n.id))
    .map((n) => n.id);
  const orphanNoteIds = graph.nodes
    .filter((n) => n.type === "note" && !seenNodeIds.has(n.id))
    .map((n) => n.id);

  for (const eid of orphanEventIds) {
    if (steps.length >= MAX_NODES_TOTAL) break;
    seenNodeIds.add(eid);
    steps.push({ nodeId: eid, nodeType: "event", edgeContext: "not linked to a contact" });
  }
  for (const tid of orphanTodoIds) {
    if (steps.length >= MAX_NODES_TOTAL) break;
    seenNodeIds.add(tid);
    steps.push({ nodeId: tid, nodeType: "todo", edgeContext: "open todo" });
  }
  for (const nid of orphanNoteIds) {
    if (steps.length >= MAX_NODES_TOTAL) break;
    seenNodeIds.add(nid);
    steps.push({ nodeId: nid, nodeType: "note", edgeContext: "trip note" });
  }

  return steps;
}

function contactLabel(c: { name?: string; company?: string }): string {
  const parts = [c.name, c.company].filter(Boolean);
  return parts.length ? (c.company ? `${c.name} (${c.company})` : String(c.name)) : "Unknown";
}

function eventLabel(e: { title?: string; start?: string }): string {
  return [e.title, e.start].filter(Boolean).join(" – ") || "Event";
}

/** Peek: full contact data + dossiers for this contact. */
function peekContact(
  nodeId: string,
  data: TripSummaryData,
  graph: KnowledgeGraph
): string {
  const c = data.contacts.find((x) => String(x.id) === String(nodeId));
  if (!c) return `[Contact ${nodeId}: not found]`;
  const dossiers = data.dossiers.filter((d) => String(d.contactId) === String(nodeId));
  const lines: string[] = [];
  lines.push(`Contact: ${contactLabel(c)}`);
  if (c.role) lines.push(`Role: ${c.role}`);
  if (c.notes) lines.push(`Notes: ${c.notes}`);
  if (c.displaySummary) lines.push(`Summary: ${c.displaySummary}`);
  if (c.researchSummary) {
    const r = c.researchSummary;
    lines.push(`Research: ${r.slice(0, 300)}${r.length > 300 ? "…" : ""}`);
  }
  if (dossiers.length) {
    const summs = dossiers.filter((d) => d.summary).map((d) => d.summary);
    if (summs.length) lines.push(`Meeting summaries: ${summs.join(" | ")}`);
    const actions = dossiers.flatMap((d) => d.actionItems ?? []);
    if (actions.length) lines.push(`Action items: ${actions.join("; ")}`);
  }
  return lines.join(". ");
}

/** Peek: full event data + attendees + dossiers for this event. */
function peekEvent(
  nodeId: string,
  data: TripSummaryData,
  graph: KnowledgeGraph
): string {
  const e = data.events.find((x) => String(x.id) === String(nodeId));
  if (!e) return `[Event ${nodeId}: not found]`;
  const contactIds = e.contactIds?.length ? e.contactIds : e.contactId ? [e.contactId] : [];
  const attendeeNames = contactIds
    .map((cid) => data.contacts.find((c) => String(c.id) === String(cid)))
    .filter(Boolean)
    .map((c) => contactLabel(c!));
  const dossiers = data.dossiers.filter((d) => String(d.eventId) === String(nodeId));
  const lines: string[] = [];
  lines.push(`Event: ${eventLabel(e)}`);
  if (e.location) lines.push(`Location: ${e.location}`);
  if (e.notes) lines.push(`Notes: ${e.notes}`);
  if (attendeeNames.length) lines.push(`Attendees: ${attendeeNames.join(", ")}`);
  if (dossiers.length) {
    const summs = dossiers.filter((d) => d.summary).map((d) => d.summary);
    if (summs.length) lines.push(`Meeting summaries: ${summs.join(" | ")}`);
  }
  return lines.join(". ");
}

/** Peek: todo + due + who it's for. */
function peekTodo(
  nodeId: string,
  data: TripSummaryData,
  graph: KnowledgeGraph
): string {
  const t = data.todos.find((x) => String(x.id) === String(nodeId));
  if (!t) return `[Todo ${nodeId}: not found]`;
  const forNames = (t.contactIds ?? [])
    .map((cid) => data.contacts.find((c) => String(c.id) === String(cid)))
    .filter(Boolean)
    .map((c) => contactLabel(c!));
  const parts = [t.text ?? ""];
  if (t.dueDate) parts.push(`(due ${t.dueDate})`);
  if (forNames.length) parts.push(`for ${forNames.join(", ")}`);
  return parts.join(" ");
}

/** Peek: full note content + what it's about. */
function peekNote(
  nodeId: string,
  data: TripSummaryData,
  graph: KnowledgeGraph
): string {
  const n = data.tripNotes.find((x) => String(x.id) === String(nodeId));
  if (!n) return `[Note ${nodeId}: not found]`;
  const aboutContacts = (n.contactIds ?? [])
    .map((cid) => data.contacts.find((c) => String(c.id) === String(cid)))
    .filter(Boolean)
    .map((c) => contactLabel(c!));
  const aboutEvents = (n.eventIds ?? [])
    .map((eid) => data.events.find((e) => String(e.id) === String(eid)))
    .filter(Boolean)
    .map((e) => eventLabel(e!));
  const parts = [`Note: ${(n.content ?? "").trim()}`];
  if (aboutContacts.length || aboutEvents.length) {
    const about = [...aboutContacts, ...aboutEvents];
    if (about.length) parts.push(`(about: ${about.join(", ")})`);
  }
  return parts.join(" ");
}

function peek(
  step: WalkStep,
  data: TripSummaryData,
  graph: KnowledgeGraph
): string {
  switch (step.nodeType) {
    case "contact":
      return peekContact(step.nodeId, data, graph);
    case "event":
      return peekEvent(step.nodeId, data, graph);
    case "todo":
      return peekTodo(step.nodeId, data, graph);
    case "note":
      return peekNote(step.nodeId, data, graph);
    default:
      return "";
  }
}

/**
 * Build the structured blob for the main LLM: walk the graph, run peeks, stitch by contact (then orphans).
 */
export function buildSummaryInputFromGraph(
  graph: KnowledgeGraph,
  data: TripSummaryData,
  walkStrategy: "byContact" = "byContact"
): string {
  const steps = walkStrategy === "byContact" ? walkGraphByContact(graph) : walkGraphByContact(graph);
  if (steps.length === 0) {
    return "No contacts, events, todos, or notes in the graph.";
  }

  const sections: string[] = [];
  const contactIdsInOrder = [...new Set(steps.map((s) => s.contactId).filter(Boolean))] as string[];
  const nodeIdToStep = new Map<string, WalkStep>();
  for (const s of steps) {
    if (!nodeIdToStep.has(s.nodeId)) nodeIdToStep.set(s.nodeId, s);
  }

  for (const cid of contactIdsInOrder) {
    const contactStep = nodeIdToStep.get(cid);
    if (!contactStep || contactStep.nodeType !== "contact") continue;
    const contactPeeks: string[] = [];
    const eventPeeks: string[] = [];
    const todoPeeks: string[] = [];
    const notePeeks: string[] = [];
    for (const s of steps) {
      if (s.contactId !== cid) continue;
      const peekStr = peek(s, data, graph);
      if (!peekStr) continue;
      if (s.nodeType === "contact") contactPeeks.push(peekStr);
      else if (s.nodeType === "event") eventPeeks.push(peekStr);
      else if (s.nodeType === "todo") todoPeeks.push(peekStr);
      else if (s.nodeType === "note") notePeeks.push(peekStr);
    }
    const contactNode = graph.nodes.find((n) => n.id === cid);
    const header = contactNode ? `## ${contactNode.label}` : `## Contact ${cid}`;
    sections.push(header);
    sections.push(contactPeeks[0] ?? "");
    if (eventPeeks.length) sections.push(`Events: ${eventPeeks.join(" | ")}`);
    if (todoPeeks.length) sections.push(`Todos: ${todoPeeks.join(" | ")}`);
    if (notePeeks.length) sections.push(`Notes: ${notePeeks.join(" | ")}`);
    sections.push("");
  }

  const orphanSteps = steps.filter((s) => !s.contactId);
  if (orphanSteps.length) {
    sections.push("## Other (events, todos, notes not linked to contacts above)");
    const peeks = orphanSteps.map((s) => peek(s, data, graph)).filter(Boolean);
    sections.push(peeks.join("\n"));
  }

  return sections.join("\n").trim();
}
