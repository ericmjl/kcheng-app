"use client";

import { useState } from "react";
import Link from "next/link";
import { QuokkaAvatar } from "./QuokkaAvatar";
import { TripAssistantChat } from "./TripAssistantChat";

export function HomeContent() {
  const [quickNote, setQuickNote] = useState("");
  const [quickNoteStatus, setQuickNoteStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [tripSummary, setTripSummary] = useState("");
  const [tripSummaryStatus, setTripSummaryStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSaveQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = quickNote.trim();
    if (!content) return;
    setQuickNoteStatus("saving");
    try {
      const res = await fetch("/api/trip-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setQuickNote("");
        setQuickNoteStatus("saved");
        setTimeout(() => setQuickNoteStatus("idle"), 2000);
      } else setQuickNoteStatus("error");
    } catch {
      setQuickNoteStatus("error");
    }
  };

  const handleGenerateTripSummary = async () => {
    setTripSummaryStatus("loading");
    setTripSummary("");
    try {
      const res = await fetch("/api/trip-summary", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setTripSummary(data.summary);
        setTripSummaryStatus("done");
      } else setTripSummaryStatus("error");
    } catch {
      setTripSummaryStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Hero: Q-tip + title */}
      <section className="flex flex-col items-center gap-2 text-center">
        <QuokkaAvatar size={160} aria-hidden={false} />
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
          Trip Assistant
        </h1>
      </section>

      {/* Quick note */}
      <section className="rounded-2xl border border-[var(--mint-soft)] bg-[var(--cream)] p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">Quick note</h2>
        <form onSubmit={handleSaveQuickNote} className="flex flex-col gap-2">
          <textarea
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Jot a note about your trip…"
            className="min-h-[4rem] w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--mint)] focus:outline-none"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!quickNote.trim() || quickNoteStatus === "saving"}
              className="rounded-lg bg-[var(--mint)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--mint-soft)] disabled:opacity-50"
            >
              {quickNoteStatus === "saving" ? "Saving…" : "Save note"}
            </button>
            {quickNoteStatus === "saved" && (
              <span className="text-sm text-[var(--mint)]">Saved.</span>
            )}
            {quickNoteStatus === "error" && (
              <span className="text-sm text-[var(--coral)]">Failed to save.</span>
            )}
          </div>
        </form>
      </section>

      {/* Inline chat (same UI as panel) */}
      <section className="min-h-[28rem] overflow-hidden rounded-2xl border border-[var(--mint-soft)] bg-[var(--cream)] shadow-sm">
        <TripAssistantChat />
      </section>

      {/* Trip summary + knowledge graph */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateTripSummary}
            disabled={tripSummaryStatus === "loading"}
            className="rounded-lg border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--mint-soft)] disabled:opacity-50"
          >
            {tripSummaryStatus === "loading" ? "Generating…" : "Generate trip summary"}
          </button>
          <Link
            href="/knowledge-graph"
            className="rounded-lg border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--mint-soft)]"
          >
            View knowledge graph
          </Link>
        </div>
        {tripSummaryStatus === "done" && tripSummary && (
          <div className="rounded-lg border border-[var(--sky-soft)] bg-[var(--cream)] p-4 text-sm text-[var(--text)]">
            <p className="whitespace-pre-wrap">{tripSummary}</p>
          </div>
        )}
        {tripSummaryStatus === "error" && (
          <p className="text-sm text-[var(--coral)]">Could not generate summary. Check Settings for an OpenAI API key.</p>
        )}
      </section>

      {/* Quick links — same as top nav */}
      <nav className="flex flex-wrap items-center justify-center gap-3 text-sm" aria-label="Quick links">
        <Link
          href="/"
          className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
        >
          Home
        </Link>
        <span className="text-[var(--text-muted)]/60" aria-hidden>·</span>
        <Link
          href="/calendar"
          className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
        >
          Calendar
        </Link>
        <span className="text-[var(--text-muted)]/60" aria-hidden>·</span>
        <Link
          href="/contacts"
          className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
        >
          Contacts
        </Link>
        <span className="text-[var(--text-muted)]/60" aria-hidden>·</span>
        <Link
          href="/todos"
          className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
        >
          To-dos
        </Link>
        <span className="text-[var(--text-muted)]/60" aria-hidden>·</span>
        <Link
          href="/notes"
          className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
        >
          Notes
        </Link>
        <span className="text-[var(--text-muted)]/60" aria-hidden>·</span>
        <Link
          href="/knowledge-graph"
          className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
        >
          Knowledge Graph
        </Link>
        <span className="text-[var(--text-muted)]/60" aria-hidden>·</span>
        <Link
          href="/settings"
          className="rounded-lg px-3 py-1.5 text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
        >
          Settings
        </Link>
      </nav>
    </div>
  );
}
