"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO, startOfDay, isSameDay } from "date-fns";
import { cachedGet } from "@/lib/cachedFetch";
import type { Todo } from "@/lib/types";

type Filter = "all" | "today";

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const loadTodos = useCallback(async () => {
    try {
      const data = await cachedGet<Todo[]>("todos", async () => {
        const res = await fetch("/api/todos", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load todos");
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      });
      setTodos(data);
    } catch (e) {
      console.warn(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const filtered =
    filter === "today"
      ? todos.filter((t) => t.dueDate && isSameDay(parseISO(t.dueDate), startOfDay(new Date())))
      : todos;

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
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setTodos((prev) => [created, ...prev]);
      setNewText("");
      setDueDate("");
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

      <form onSubmit={addTodo} className="mb-6 flex flex-wrap items-end gap-2">
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
          <li className="py-4 text-center text-[var(--text)]0 text-sm">
            {filter === "today" ? "No todos due today." : "No todos yet."}
          </li>
        )}
        {filtered.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2"
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggleDone(t)}
              className="h-4 w-4 rounded border-[var(--mint-soft)]"
            />
            <span
              className={`flex-1 ${t.done ? "text-[var(--text)]0 line-through" : "text-[var(--text)]"}`}
            >
              {t.text}
            </span>
            {t.dueDate && (
              <span className="text-xs text-[var(--text)]0">
                {format(parseISO(t.dueDate), "MMM d")}
              </span>
            )}
            <button
              type="button"
              onClick={() => deleteTodo(t.id)}
              className="text-sm text-[var(--coral)] hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
