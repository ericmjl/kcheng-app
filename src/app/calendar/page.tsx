"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  format,
  parseISO,
  eachDayOfInterval,
  isSameDay,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  getDate,
  isToday,
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

/** Build calendar grid for a month: 6 rows × 7 days (Sun–Sat). */
function getCalendarDays(month: Date): Date[][] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });
  const rows: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }
  return rows;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
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

  useEffect(() => {
    const onDataChanged = () => loadSettingsAndEvents();
    window.addEventListener("trip-assistant:data-changed", onDataChanged);
    return () => window.removeEventListener("trip-assistant:data-changed", onDataChanged);
  }, [loadSettingsAndEvents]);

  useEffect(() => {
    const onFocus = () => loadSettingsAndEvents();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadSettingsAndEvents]);

  const calendarRows = useMemo(() => getCalendarDays(currentMonth), [currentMonth]);
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

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--text)]">Calendar</h1>

      {/* Month navigation + grid */}
      <div className="mb-8 rounded-xl border border-[var(--mint-soft)] bg-[var(--cream)] p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="rounded-lg border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] hover:bg-[var(--mint-soft)]"
            aria-label="Previous month"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="rounded-lg border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] hover:bg-[var(--mint-soft)]"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-1 text-xs font-medium uppercase text-[var(--text-muted)]"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarRows.flat().map((day) => {
            const inMonth = isSameMonth(day, currentMonth);
            const selected = selectedDay && isSameDay(day, selectedDay);
            const today = isToday(day);
            const count = eventsForDay(events, day).length;
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`
                  flex min-h-[3rem] flex-col items-center justify-start rounded-lg border py-1.5 transition-colors
                  ${!inMonth ? "border-transparent bg-transparent text-[var(--text-muted)]/50" : ""}
                  ${inMonth ? "border-[var(--mint-soft)] bg-[var(--wall)] text-[var(--text)] hover:bg-[var(--mint-soft)]" : ""}
                  ${selected ? "border-[var(--mint)] bg-[var(--mint)] font-semibold hover:bg-[var(--mint)]" : ""}
                  ${today && !selected ? "ring-1 ring-[var(--coral)]" : ""}
                `}
              >
                <span className="text-sm">{getDate(day)}</span>
                {count > 0 && (
                  <span className="mt-0.5 flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className="h-1 w-1 rounded-full bg-[var(--coral)]"
                      />
                    ))}
                    {count > 3 && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        +{count - 3}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay ? (
        <section className="rounded-xl border border-[var(--mint-soft)] bg-[var(--cream)] p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-[var(--text)]">
            {format(selectedDay, "EEEE, MMMM d, yyyy")}
          </h2>
          <form onSubmit={saveEvent} className="mb-6">
            <input
              type="text"
              placeholder="Event title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="mb-2 w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
              required
            />
            <div className="mb-2 flex gap-2">
              <input
                type="time"
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
                className="rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)]"
              />
              <input
                type="text"
                placeholder="Location"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
              />
            </div>
            <textarea
              placeholder="Notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="mb-2 w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-[var(--mint)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:opacity-90"
              >
                {editingEvent ? "Update" : "Add"} event
              </button>
              {editingEvent && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-[var(--mint-soft)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
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
                  className="flex items-start justify-between gap-2 rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] p-3"
                >
                  <div>
                    <p className="font-medium text-[var(--text)]">{ev.title}</p>
                    {ev.start && (
                      <p className="text-sm text-[var(--text-muted)]">
                        {format(parseISO(ev.start), "h:mm a")}
                      </p>
                    )}
                    {ev.location && (
                      <p className="text-sm text-[var(--text-muted)]">
                        {ev.location}
                      </p>
                    )}
                    {ev.notes && (
                      <p className="mt-1 text-sm text-[var(--text)]">
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
            <p className="text-sm text-[var(--text-muted)]">
              No events this day. Add one above.
            </p>
          )}
        </section>
      ) : (
        <p className="text-[var(--text-muted)]">
          Click a day on the calendar to view and add events.
        </p>
      )}
    </main>
  );
}
