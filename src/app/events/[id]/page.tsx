"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { Event, Contact } from "@/lib/types";
import { getEventContactIds } from "@/lib/types";

const PencilIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<"title" | "datetime" | "location" | "notes" | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!id) return null;
    const res = await fetch(`/api/events/${id}`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [eventData, contactsRes] = await Promise.all([
          loadEvent(),
          fetch("/api/contacts", { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (eventData) setEvent(eventData);
        if (contactsRes.ok) {
          const list = await contactsRes.json();
          setContacts(Array.isArray(list) ? list : []);
        }
      } catch {
        if (!cancelled) setEvent(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, loadEvent]);

  const contactById = contacts.length ? Object.fromEntries(contacts.map((c) => [c.id, c])) : {};

  function startEditField(field: "title" | "datetime" | "location" | "notes") {
    if (!event) return;
    setSaveError(null);
    setEditingField(field);
    setEditTitle(event.title);
    setEditLocation(event.location ?? "");
    setEditNotes(event.notes ?? "");
    if (event.start) {
      try {
        const d = parseISO(event.start);
        setEditStart(format(d, "yyyy-MM-dd'T'HH:mm"));
      } catch {
        setEditStart("");
      }
    } else setEditStart("");
    if (event.end) {
      try {
        const d = parseISO(event.end);
        setEditEnd(format(d, "yyyy-MM-dd'T'HH:mm"));
      } catch {
        setEditEnd("");
      }
    } else setEditEnd("");
  }

  async function saveField() {
    if (!event?.id || !editingField || saving) return;
    setSaving(true);
    try {
      const body: Record<string, string | undefined> = {};
      if (editingField === "title") body.title = editTitle.trim() || event.title;
      if (editingField === "location") body.location = editLocation.trim() || undefined;
      if (editingField === "notes") body.notes = editNotes.trim() || undefined;
      if (editingField === "datetime") {
        if (editStart) body.start = editStart.length <= 10 ? `${editStart}T09:00:00` : `${editStart}:00`;
        if (editEnd?.trim()) body.end = editEnd.length <= 10 ? undefined : `${editEnd}:00`;
      }
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEvent(data);
        setEditingField(null);
        setSaveError(null);
      } else {
        setSaveError((data as { error?: string }).error ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleBlur() {
    if (editingField && !saving) saveField();
  }

  async function handleDelete() {
    if (!event?.id || !confirm("Delete this event?")) return;
    const res = await fetch(`/api/events/${event.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) router.push("/calendar");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-[var(--text-muted)]">Event not found.</p>
        <Link href="/calendar" className="mt-2 inline-block text-sm text-[var(--sky)] underline hover:no-underline">
          ← Back to calendar
        </Link>
      </main>
    );
  }

  const startDate = event.start ? parseISO(event.start) : null;
  const endDate = event.end ? parseISO(event.end) : null;
  const contactIds = getEventContactIds(event);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/calendar" className="text-sm text-[var(--text-muted)] hover:underline">
          ← Calendar
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/calendar?edit=${event.id}`}
            className="rounded-lg border border-[var(--mint-soft)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
          >
            Edit participants
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--coral)] hover:bg-[var(--peach)]/30"
          >
            Delete
          </button>
        </div>
      </div>

      {saveError && (
        <p className="mb-3 rounded-lg bg-[var(--peach)]/30 px-3 py-2 text-sm text-[var(--coral)]" role="alert">
          {saveError}
        </p>
      )}

      {/* Title — inline edit */}
      <div className="group flex items-baseline gap-2">
        {editingField === "title" ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField(); } }}
              autoFocus
              className="min-w-0 flex-1 rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1 text-2xl font-semibold text-[var(--text)]"
            />
            <button
              type="button"
              onClick={() => saveField()}
              disabled={saving}
              className="shrink-0 rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "…" : "Done"}
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-[var(--text)]">{event.title}</h1>
            <button
              type="button"
              onClick={() => startEditField("title")}
              disabled={saving}
              className="inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70"
              aria-label="Edit title"
            >
              <PencilIcon />
            </button>
          </>
        )}
      </div>

      <dl className="mt-6 space-y-3 text-sm">
        {/* Date & time — inline edit */}
        <div>
          <dt className="text-[var(--text-muted)]">Date & time</dt>
          <dd className="mt-0.5 group">
            {editingField === "datetime" ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  onBlur={handleBlur}
                  className="rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1.5 text-[var(--text)]"
                />
                <span className="text-[var(--text-muted)]">to</span>
                <input
                  type="datetime-local"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  onBlur={handleBlur}
                  className="rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1.5 text-[var(--text)]"
                />
                <button
                  type="button"
                  onClick={() => saveField()}
                  disabled={saving}
                  className="rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "…" : "Done"}
                </button>
              </div>
            ) : startDate ? (
              <>
                <span className="font-medium text-[var(--text)]">
                  {format(startDate, "EEEE, MMMM d, yyyy")} at {format(startDate, "h:mm a")}
                  {endDate && ` – ${format(endDate, "h:mm a")}`}
                </span>
                <button
                  type="button"
                  onClick={() => startEditField("datetime")}
                  disabled={saving}
                  className="ml-1.5 inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70"
                  aria-label="Edit date and time"
                >
                  <PencilIcon />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => startEditField("datetime")}
                disabled={saving}
                className="text-[var(--sky)] underline hover:no-underline"
              >
                Add date & time
              </button>
            )}
          </dd>
        </div>

        {/* Location — inline edit */}
        <div>
          <dt className="text-[var(--text-muted)]">Location</dt>
          <dd className="mt-0.5 group">
            {editingField === "location" ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveField(); } }}
                  placeholder="Add location"
                  autoFocus
                  className="min-w-0 flex-1 rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1.5 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
                <button
                  type="button"
                  onClick={() => saveField()}
                  disabled={saving}
                  className="shrink-0 rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "…" : "Done"}
                </button>
              </div>
            ) : (
              <>
                <span className="text-[var(--text)]">{event.location || "—"}</span>
                <button
                  type="button"
                  onClick={() => startEditField("location")}
                  disabled={saving}
                  className="ml-1.5 inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70"
                  aria-label="Edit location"
                >
                  <PencilIcon />
                </button>
              </>
            )}
          </dd>
        </div>

        {/* Contacts — single section with pills; edit participants via calendar */}
        <div>
          <dt className="text-[var(--text-muted)]">Contacts</dt>
          <dd className="mt-1.5">
            {contactIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {contactIds.map((cid) => {
                  const c = contactById[cid];
                  const label = c ? (c.company ? `${c.name} (${c.company})` : c.name) : "Contact";
                  return (
                    <Link
                      key={cid}
                      href={`/contacts/${cid}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-1.5 text-sm font-medium text-[var(--text)] shadow-sm transition-colors hover:border-[var(--mint)] hover:bg-[var(--mint-soft)]"
                    >
                      <span>{label}</span>
                      <span className="text-[var(--text-muted)]" aria-hidden>→</span>
                    </Link>
                  );
                })}
                <Link
                  href={`/calendar?edit=${event.id}`}
                  className="inline-flex items-center rounded-full border border-dashed border-[var(--mint-soft)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:border-[var(--mint)] hover:bg-[var(--mint-soft)]/50 hover:text-[var(--text)]"
                >
                  Edit participants
                </Link>
              </div>
            ) : (
              <Link
                href={`/calendar?edit=${event.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--mint-soft)] bg-[var(--wall)]/50 px-3 py-2 text-sm text-[var(--text-muted)] hover:border-[var(--mint)] hover:bg-[var(--mint-soft)]/30 hover:text-[var(--text)]"
              >
                Link this meeting to a contact
              </Link>
            )}
          </dd>
        </div>

        {/* Notes — inline edit */}
        <div>
          <dt className="text-[var(--text-muted)]">Notes</dt>
          <dd className="mt-0.5 group">
            {editingField === "notes" ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  onBlur={handleBlur}
                  placeholder="Add notes"
                  rows={3}
                  autoFocus
                  className="w-full rounded border border-[var(--mint-soft)] bg-[var(--wall)] px-2 py-1.5 text-[var(--text)] placeholder-[var(--text-muted)]"
                />
                <button
                  type="button"
                  onClick={() => saveField()}
                  disabled={saving}
                  className="self-start rounded bg-[var(--mint)] px-2.5 py-1 text-sm font-medium text-[var(--text)] hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "…" : "Done"}
                </button>
              </div>
            ) : (
              <>
                <span className="whitespace-pre-wrap text-[var(--text)]">{event.notes || "—"}</span>
                <button
                  type="button"
                  onClick={() => startEditField("notes")}
                  disabled={saving}
                  className="ml-1.5 inline-flex shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-70"
                  aria-label="Edit notes"
                >
                  <PencilIcon />
                </button>
              </>
            )}
          </dd>
        </div>
      </dl>
    </main>
  );
}
