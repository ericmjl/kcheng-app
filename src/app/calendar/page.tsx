"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format,
  parseISO,
  eachDayOfInterval,
  isSameDay,
  startOfDay,
  isWithinInterval,
} from "date-fns";
import { getLocalSettings } from "@/lib/settings";
import { cachedGet } from "@/lib/cachedFetch";
import type { Event } from "@/lib/types";

function getTripDays(tripStart: string, tripEnd: string): Date[] {
  if (!tripStart || !tripEnd) return [];
  try {
    const start = startOfDay(parseISO(tripStart));
    const end = startOfDay(parseISO(tripEnd));
    if (start > end) return [];
    return eachDayOfInterval({ start, end });
  } catch {
    return [];
  }
}

function eventsForDay(events: Event[], day: Date): Event[] {
  return events.filter((e) => {
    try {
      const d = parseISO(e.start);
      return isSameDay(d, day);
    } catch {
      return false;
    }
  });
}

export default function CalendarPage() {
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const loadSettingsAndEvents = useCallback(async () => {
    const local = getLocalSettings();
    setTripStart(local.tripStart ?? "");
    setTripEnd(local.tripEnd ?? "");
    try {
      const data = await cachedGet<Event[]>("events", async () => {
        const res = await fetch("/api/events", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load events");
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      });
      setEvents(data);
    } catch (e) {
      console.warn("Events load failed", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettingsAndEvents();
  }, [loadSettingsAndEvents]);

  const tripDays = getTripDays(tripStart, tripEnd);
  const selectedDayEvents = selectedDay
    ? eventsForDay(events, selectedDay)
    : [];

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !selectedDay) return;
    const dayStr = format(selectedDay, "yyyy-MM-dd");
    const start = formStart ? `${dayStr}T${formStart}:00` : `${dayStr}T09:00:00`;
    if (editingEvent) {
      const res = await fetch(`/api/events/${editingEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: formTitle.trim(),
          start,
          location: formLocation.trim() || undefined,
          notes: formNotes.trim() || undefined,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEvents((prev) =>
          prev.map((ev) => (ev.id === updated.id ? updated : ev))
        );
        setEditingEvent(null);
        resetForm();
      }
    } else {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: formTitle.trim(),
          start,
          location: formLocation.trim() || undefined,
          notes: formNotes.trim() || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setEvents((prev) => [...prev, created]);
        resetForm();
      }
    }
  }

  function resetForm() {
    setFormTitle("");
    setFormStart("");
    setFormLocation("");
    setFormNotes("");
    setEditingEvent(null);
  }

  function startEdit(ev: Event) {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormStart(ev.start ? format(parseISO(ev.start), "HH:mm") : "");
    setFormLocation(ev.location ?? "");
    setFormNotes(ev.notes ?? "");
  }

  async function deleteEvent(id: string) {
    const res = await fetch(`/api/events/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </main>
    );
  }

  if (!tripStart || !tripEnd) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Calendar</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Set your trip start and end dates in{" "}
          <a href="/settings" className="text-[var(--text-muted)] hover:underline">
            Settings
          </a>{" "}
          to see your calendar.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-[var(--text)]">Calendar</h1>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <h2 className="mb-2 text-sm font-medium text-[var(--text-muted)]">
            Days in China
          </h2>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-2">
            {tripDays.map((day) => (
              <li key={day.toISOString()}>
                <button
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`w-full rounded px-3 py-2 text-left text-sm ${
                    selectedDay && isSameDay(day, selectedDay)
                      ? "bg-[var(--mint)] text-[var(--text)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
                  }`}
                >
                  {format(day, "EEE, MMM d")}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div>
          {selectedDay ? (
            <>
              <h2 className="mb-3 text-lg font-medium text-[var(--text)]">
                {format(selectedDay, "EEEE, MMMM d, yyyy")}
              </h2>
              <form onSubmit={saveEvent} className="mb-6 rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-4">
                <input
                  type="text"
                  placeholder="Event title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="mb-2 w-full rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
                  required
                />
                <div className="mb-2 flex gap-2">
                  <input
                    type="time"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)]"
                  />
                  <input
                    type="text"
                    placeholder="Location"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="flex-1 rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
                  />
                </div>
                <textarea
                  placeholder="Notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="mb-2 w-full rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded bg-[var(--mint)] px-3 py-1.5 text-sm text-[var(--text)] hover:opacity-90"
                  >
                    {editingEvent ? "Update" : "Add"} event
                  </button>
                  {editingEvent && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded border border-[var(--mint-soft)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
              <ul className="space-y-2">
                {selectedDayEvents
                  .sort(
                    (a, b) =>
                      new Date(a.start).getTime() - new Date(b.start).getTime()
                  )
                  .map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-start justify-between gap-2 rounded border border-[var(--mint-soft)] bg-[var(--cream)] p-3"
                    >
                      <div>
                        <p className="font-medium text-[var(--text)]">{ev.title}</p>
                        {ev.start && (
                          <p className="text-sm text-[var(--text-muted)]">
                            {format(parseISO(ev.start), "h:mm a")}
                          </p>
                        )}
                        {ev.location && (
                          <p className="text-sm text-[var(--text-muted)]">{ev.location}</p>
                        )}
                        {ev.notes && (
                          <p className="mt-1 text-sm text-[var(--text)]0">
                            {ev.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(ev)}
                          className="rounded px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEvent(ev.id)}
                          className="rounded px-2 py-1 text-sm text-[var(--coral)] hover:bg-[var(--peach)]/30"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
              {selectedDayEvents.length === 0 && (
                <p className="text-[var(--text)]0 text-sm">No events this day.</p>
              )}
            </>
          ) : (
            <p className="text-[var(--text-muted)]">
              Select a day from the list to view and add events.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
