"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { WhatsNext } from "./WhatsNext";
import type { Event } from "@/lib/types";

export function HomeContent() {
  const [events, setEvents] = useState<Event[]>([]);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const onDataChanged = () => loadEvents();
    window.addEventListener("trip-assistant:data-changed", onDataChanged);
    return () => window.removeEventListener("trip-assistant:data-changed", onDataChanged);
  }, [loadEvents]);

  return (
    <>
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-[var(--text)]">
        China Trip Planner
      </h1>
      <p className="mb-6 text-[var(--text-muted)]">
        Your calendar, contacts, meetings, trains, and todos in one place.
      </p>
      <div className="mb-8">
        <WhatsNext events={events} maxItems={3} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/calendar"
          className="rounded-2xl border-2 border-[var(--mint-soft)] bg-[var(--cream)] p-4 shadow-sm transition hover:border-[var(--mint)] hover:shadow"
        >
          <h2 className="font-semibold text-[var(--text)]">Calendar</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            View each day of your trip and manage events.
          </p>
        </Link>
        <Link
          href="/contacts"
          className="rounded-2xl border-2 border-[var(--sky-soft)] bg-[var(--cream)] p-4 shadow-sm transition hover:border-[var(--sky)] hover:shadow"
        >
          <h2 className="font-semibold text-[var(--text)]">Contacts</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Notes, companies, and meeting dossiers.
          </p>
        </Link>
        <Link
          href="/todos"
          className="rounded-2xl border-2 border-[var(--peach)]/60 bg-[var(--cream)] p-4 shadow-sm transition hover:border-[var(--peach)] hover:shadow"
        >
          <h2 className="font-semibold text-[var(--text)]">Todos</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            End-of-day list: emails, follow-ups, bookings.
          </p>
        </Link>
        <Link
          href="/settings"
          className="rounded-2xl border-2 border-[var(--wood)] bg-[var(--cream)] p-4 shadow-sm transition hover:border-[var(--coral)]/50 hover:shadow"
        >
          <h2 className="font-semibold text-[var(--text)]">Settings</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Trip dates, timezone, and API keys.
          </p>
        </Link>
      </div>
    </>
  );
}
