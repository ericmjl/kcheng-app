"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { format, parseISO, startOfDay, isSameDay } from "date-fns";
import { cachedGet } from "@/lib/cachedFetch";
import type { Todo, Contact } from "@/lib/types";

type Filter = "all" | "today";

type TextSegment =
  | { type: "text"; value: string }
  | { type: "link"; contactId: string; name: string };

/** Split todo text by linked contact names (longest first) so names can be rendered as links with current backend names. */
function segmentTodoTextWithContacts(
  text: string,
  contacts: { id: string; name: string }[]
): TextSegment[] {
  if (contacts.length === 0) return [{ type: "text", value: text }];
  const sorted = [...contacts].filter((c) => c.name?.trim()).sort((a, b) => b.name.length - a.name.length);
  let segments: TextSegment[] = [{ type: "text", value: text }];
  for (const c of sorted) {
    const next: TextSegment[] = [];
    for (const seg of segments) {
      if (seg.type !== "text") {
        next.push(seg);
        continue;
      }
      const parts = seg.value.split(c.name);
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) next.push({ type: "text", value: parts[i] });
        if (i < parts.length - 1) next.push({ type: "link", contactId: c.id, name: c.name });
      }
    }
    segments = next;
  }
  return segments;
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [newContactIds, setNewContactIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  const loadTodos = useCallback(async () => {
    try {
      const [todosData, contactsRes] = await Promise.all([
        cachedGet<Todo[]>("todos", async () => {
          const res = await fetch("/api/todos", { credentials: "include" });
          if (!res.ok) throw new Error("Failed to load todos");
          const json = await res.json();
          return Array.isArray(json) ? json : [];
        }),
        fetch("/api/contacts", { credentials: "include" }),
      ]);
      setTodos(todosData);
      if (contactsRes.ok) {
        const list = await contactsRes.json();
        setContacts(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.warn(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    const onDataChanged = () => loadTodos();
    window.addEventListener("trip-assistant:data-changed", onDataChanged);
    return () => window.removeEventListener("trip-assistant:data-changed", onDataChanged);
  }, [loadTodos]);

  const filtered =
    filter === "today"
      ? todos.filter((t) => t.dueDate && isSameDay(parseISO(t.dueDate), startOfDay(new Date())))
      : todos;

  const contactById = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, c])), [contacts]);

  function toggleNewContact(id: string) {
    setNewContactIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        text,
        done: false,
        dueDate: dueDate || undefined,
        contactIds: newContactIds.length ? newContactIds : undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setTodos((prev) => [created, ...prev]);
      setNewText("");
      setDueDate("");
      setNewContactIds([]);
    }
  }

  async function toggleDone(t: Todo) {
    const res = await fetch(`/api/todos/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ done: !t.done }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTodos((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    }
  }

  async function deleteTodo(id: string) {
    const res = await fetch(`/api/todos/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) setTodos((prev) => prev.filter((x) => x.id !== id));
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-[var(--text-muted)]">Loading todos…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-[var(--text)]">Todos</h1>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        End-of-day list: email back, follow-ups, book trains, etc.
      </p>

      <form onSubmit={addTodo} className="mb-6 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="text"
            placeholder="e.g. Email back to Li Ming"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="min-w-[200px] flex-1 rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)]"
          />
          <button
            type="submit"
            className="rounded bg-[var(--mint)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:opacity-90"
          >
            Add
          </button>
        </div>
        {contacts.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-[var(--text-muted)]">Link to contacts (names in the todo will become clickable)</p>
            <div className="flex flex-wrap gap-2">
              {contacts.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--mint-soft)] bg-[var(--wall)] px-2.5 py-1 text-sm hover:bg-[var(--mint-soft)]/30">
                  <input
                    type="checkbox"
                    checked={newContactIds.includes(c.id)}
                    onChange={() => toggleNewContact(c.id)}
                    className="rounded border-[var(--mint-soft)]"
                  />
                  <span className="text-[var(--text)]">{c.name}{c.company ? ` (${c.company})` : ""}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </form>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded px-3 py-1.5 text-sm ${
            filter === "all" ? "bg-[var(--mint)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--cream)]"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter("today")}
          className={`rounded px-3 py-1.5 text-sm ${
            filter === "today" ? "bg-[var(--mint)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--cream)]"
          }`}
        >
          Today
        </button>
      </div>

      <ul className="space-y-2">
        {filtered.length === 0 && (
          <li className="py-4 text-center text-[var(--text-muted)] text-sm">
            {filter === "today" ? "No todos due today." : "No todos yet."}
          </li>
        )}
        {filtered.map((t) => {
          const linkedContacts = (t.contactIds ?? [])
            .map((cid) => contactById[cid])
            .filter(Boolean) as Contact[];
          const segments = segmentTodoTextWithContacts(t.text, linkedContacts.map((c) => ({ id: c.id, name: c.name })));
          return (
            <li
              key={t.id}
              className="flex items-start gap-3 rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2"
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleDone(t)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--mint-soft)]"
              />
              <div className="min-w-0 flex-1">
                <span
                  className={`${t.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text)]"}`}
                >
                  {segments.map((seg, i) =>
                    seg.type === "text" ? (
                      <span key={i}>{seg.value}</span>
                    ) : (
                      <Link
                        key={`${seg.contactId}-${i}`}
                        href={`/contacts/${seg.contactId}`}
                        className="font-medium text-[var(--sky)] underline hover:no-underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {seg.name}
                      </Link>
                    )
                  )}
                </span>
                {linkedContacts.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {linkedContacts.map((c) => (
                      <Link
                        key={c.id}
                        href={`/contacts/${c.id}`}
                        className="inline-flex items-center rounded-full border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-0.5 text-xs text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.company ? `${c.name} (${c.company})` : c.name} →
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {t.dueDate && (
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {format(parseISO(t.dueDate), "MMM d")}
                </span>
              )}
              <button
                type="button"
                onClick={() => deleteTodo(t.id)}
                className="shrink-0 text-sm text-[var(--coral)] hover:underline"
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
