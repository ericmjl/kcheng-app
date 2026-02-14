"use client";

import Link from "next/link";
import { QuokkaAvatar } from "./QuokkaAvatar";
import { TripAssistantChat } from "./TripAssistantChat";

export function HomeContent() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero: Q-tip + title */}
      <section className="flex flex-col items-center gap-2 text-center">
        <QuokkaAvatar size={160} aria-hidden={false} />
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
          Trip Assistant
        </h1>
      </section>

      {/* Inline chat (same UI as panel) */}
      <section className="min-h-[28rem] overflow-hidden rounded-2xl border border-[var(--mint-soft)] bg-[var(--cream)] shadow-sm">
        <TripAssistantChat />
      </section>

      {/* Quick links */}
      <nav className="flex flex-wrap items-center justify-center gap-3 text-sm" aria-label="Quick links">
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
          Todos
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
