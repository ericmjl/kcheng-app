"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { KnowledgeGraphFlow } from "./KnowledgeGraphFlow";

type GraphNode = {
  id: string;
  type: string;
  label: string;
  done?: boolean;
  [key: string]: unknown;
};
type GraphEdge = { from: string; to: string; type: string };
type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

export default function KnowledgeGraphPage() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/knowledge-graph", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setGraph(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Failed to load knowledge graph");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-[var(--text-muted)]">Loading knowledge graph…</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-[var(--coral)]">{error}</p>
        <Link
          href="/"
          className="mt-2 inline-block text-sm text-[var(--mint)] hover:underline"
        >
          Back to home
        </Link>
      </main>
    );
  }

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const attendedEdges = edges.filter((e) => e.type === "attended");
  const todoForEdges = edges.filter((e) => e.type === "todo_for");
  const aboutEdges = edges.filter((e) => e.type === "about");

  const todoNodesDone = new Set(
    nodes.filter((n) => n.type === "todo" && n.done === true).map((n) => n.id)
  );
  const openTodoForEdges = todoForEdges.filter((e) => !todoNodesDone.has(e.to));

  const hasAnyConnections =
    attendedEdges.length > 0 || openTodoForEdges.length > 0 || aboutEdges.length > 0;
  const hasAnyNodes = nodes.length > 0;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Home
        </Link>
        <span className="text-[var(--text-muted)]">/</span>
        <h1 className="text-xl font-bold text-[var(--text)]">Knowledge graph</h1>
      </div>
      <p className="mb-2 text-sm text-[var(--text-muted)]">
        Contacts, events, todos, and notes and how they connect. Q-tip uses this
        graph to answer questions like &quot;Who am I meeting?&quot; and
        &quot;What follow-ups for Jane?&quot;
      </p>
      <p className="mb-6 text-xs text-[var(--text-muted)]">
        Click a card to select; use <kbd className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-1 font-mono">↑</kbd>{" "}
        <kbd className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-1 font-mono">↓</kbd> to
        move between nodes. Drag to pan, scroll to zoom.
      </p>

      {!hasAnyNodes && (
        <p className="rounded-2xl border border-[var(--mint-soft)] bg-[var(--cream)] p-4 text-sm text-[var(--text-muted)]">
          No contacts, events, or todos yet. Add events with contacts and todos
          with @-mentions to see connections here.{" "}
          <Link href="/" className="text-[var(--mint)] hover:underline">
            Back to home
          </Link>
        </p>
      )}

      {hasAnyNodes && (
        <section className="mb-8">
          <KnowledgeGraphFlow graph={graph!} />
        </section>
      )}

      {hasAnyNodes && hasAnyConnections && (
        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-[var(--text)]">Relationships</h2>
          {attendedEdges.length > 0 && (
            <section className="rounded-2xl border border-[var(--mint-soft)] bg-[var(--cream)] p-4">
              <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                Meetings ({attendedEdges.length})
              </h2>
              <ul className="space-y-2 text-sm">
                {attendedEdges.map((e, i) => {
                  const fromLabel =
                    nodeById.get(e.from)?.label ?? e.from;
                  const toNode = nodeById.get(e.to);
                  const toLabel = toNode?.label ?? e.to;
                  const eventId = e.to;
                  return (
                    <li
                      key={`attended-${e.from}-${e.to}-${i}`}
                      className="text-[var(--text)]"
                    >
                      <Link
                        href={`/contacts/${e.from}`}
                        className="font-medium text-[var(--mint)] hover:underline"
                      >
                        {fromLabel}
                      </Link>
                      {" attends "}
                      <Link
                        href={`/events/${eventId}`}
                        className="font-medium text-[var(--mint)] hover:underline"
                      >
                        {toLabel}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {openTodoForEdges.length > 0 && (
            <section className="rounded-2xl border border-[var(--mint-soft)] bg-[var(--cream)] p-4">
              <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                Follow-ups ({openTodoForEdges.length})
              </h2>
              <ul className="space-y-2 text-sm">
                {openTodoForEdges.map((e, i) => {
                  const todoLabel =
                    nodeById.get(e.to)?.label ?? e.to;
                  const contactLabel =
                    nodeById.get(e.from)?.label ?? e.from;
                  return (
                    <li
                      key={`todo_for-${e.from}-${e.to}-${i}`}
                      className="text-[var(--text)]"
                    >
                      <span className="font-medium">{todoLabel}</span>
                      {" is for "}
                      <Link
                        href={`/contacts/${e.from}`}
                        className="font-medium text-[var(--mint)] hover:underline"
                      >
                        {contactLabel}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                <Link href="/todos" className="text-[var(--mint)] hover:underline">
                  Open todos
                </Link>
              </p>
            </section>
          )}

          {aboutEdges.length > 0 && (
            <section className="rounded-2xl border border-[var(--mint-soft)] bg-[var(--cream)] p-4">
              <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                Notes ({aboutEdges.length})
              </h2>
              <ul className="space-y-2 text-sm">
                {aboutEdges.map((e, i) => {
                  const noteLabel =
                    nodeById.get(e.from)?.label ?? e.from;
                  const targetLabel =
                    nodeById.get(e.to)?.label ?? e.to;
                  const targetNode = nodeById.get(e.to);
                  const isContact = targetNode?.type === "contact";
                  const href = isContact
                    ? `/contacts/${e.to}`
                    : `/events/${e.to}`;
                  return (
                    <li
                      key={`about-${e.from}-${e.to}-${i}`}
                      className="text-[var(--text)]"
                    >
                      Note &quot;{noteLabel}&quot; about{" "}
                      <Link
                        href={href}
                        className="font-medium text-[var(--mint)] hover:underline"
                      >
                        {targetLabel}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
