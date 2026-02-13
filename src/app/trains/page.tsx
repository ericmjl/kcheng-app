"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import type { PlannedRoute } from "@/lib/types";

const TRIP_COM_TRAINS_URL = "https://www.trip.com/trains/";

export default function TrainsPage() {
  const [routes, setRoutes] = useState<PlannedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const loadRoutes = useCallback(async () => {
    try {
      const res = await fetch("/api/planned-routes", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRoutes(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.warn(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  async function addRoute(e: React.FormEvent) {
    e.preventDefault();
    const fromTrim = from.trim();
    const toTrim = to.trim();
    const dateTrim = date.trim();
    if (!fromTrim || !toTrim || !dateTrim) return;
    const res = await fetch("/api/planned-routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        from: fromTrim,
        to: toTrim,
        date: dateTrim,
        notes: notes.trim() || undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setRoutes((prev) => [...prev, created]);
      setFrom("");
      setTo("");
      setDate("");
      setNotes("");
    }
  }

  async function deleteRoute(id: string) {
    const res = await fetch(`/api/planned-routes/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) setRoutes((prev) => prev.filter((r) => r.id !== id));
  }

  function openTripCom() {
    window.open(TRIP_COM_TRAINS_URL, "_blank");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-[var(--text)]">High-speed trains</h1>
      <p className="mb-4 text-[var(--text-muted)]">
        Plan routes and book on Trip.com. Add your planned trips below, then open Trip.com to book.
      </p>

      <div className="mb-6">
        <button
          type="button"
          onClick={openTripCom}
          className="rounded bg-[var(--mint)] px-4 py-2 font-medium text-[var(--text)] hover:opacity-90"
        >
          Book train on Trip.com
        </button>
        <p className="mt-2 text-xs text-[var(--text)]0">
          Opens Trip.com trains in a new tab. You can book high-speed rail there.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-medium text-[var(--text)]">Planned routes</h2>
        <form onSubmit={addRoute} className="mb-4 grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="From (e.g. Beijing)"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
          />
          <input
            type="text"
            placeholder="To (e.g. Shanghai)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)]"
          />
          <input
            type="text"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)] sm:col-span-2"
          />
          <button
            type="submit"
            className="rounded bg-[var(--mint)] px-4 py-2 text-sm text-[var(--text)] hover:opacity-90 sm:col-span-2"
          >
            Add route
          </button>
        </form>
        <ul className="space-y-2">
          {routes.length === 0 && (
            <li className="text-sm text-[var(--text)]0">No planned routes yet.</li>
          )}
          {routes.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2"
            >
              <div>
                <p className="font-medium text-[var(--text)]">
                  {r.from} → {r.to}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  {r.date ? format(parseISO(r.date), "EEE, MMM d, yyyy") : r.date}
                </p>
                {r.notes && (
                  <p className="text-xs text-[var(--text)]0">{r.notes}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openTripCom}
                  className="rounded px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
                >
                  Book
                </button>
                <button
                  type="button"
                  onClick={() => deleteRoute(r.id)}
                  className="rounded px-2 py-1 text-sm text-[var(--coral)] hover:bg-[var(--peach)]/30"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
