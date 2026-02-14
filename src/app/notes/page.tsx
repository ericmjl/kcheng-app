"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type TripNote = {
  id: string;
  content: string;
  createdAt: string;
  contactIds?: string[];
  eventIds?: string[];
};

type Contact = { id: string; name?: string; company?: string };
type Event = { id: string; title?: string; start?: string };

export default function NotesPage() {
  const [notes, setNotes] = useState<TripNote[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContactIds, setEditContactIds] = useState<string[]>([]);
  const [editEventIds, setEditEventIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/trip-notes", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/contacts", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/events", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([notesData, contactsData, eventsData]) => {
        if (cancelled) return;
        setNotes(Array.isArray(notesData) ? notesData : []);
        setContacts(Array.isArray(contactsData) ? contactsData : []);
        setEvents(Array.isArray(eventsData) ? eventsData : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const eventById = new Map(events.map((e) => [e.id, e]));

  const startEditing = (note: TripNote) => {
    setError(null);
    setEditingNoteId(note.id);
    setEditContactIds(note.contactIds ?? []);
    setEditEventIds(note.eventIds ?? []);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
  };

  const saveLinks = async () => {
    if (!editingNoteId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/trip-notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: editingNoteId,
          contactIds: editContactIds,
          eventIds: editEventIds,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setError(null);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === editingNoteId
            ? {
                ...n,
                contactIds: updated.contactIds ?? n.contactIds,
                eventIds: updated.eventIds ?? n.eventIds,
              }
            : n
        )
      );
      setEditingNoteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const toggleContact = (id: string) => {
    setEditContactIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleEvent = (id: string) => {
    setEditEventIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-[var(--text-muted)]">Loading trip notes…</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-[var(--coral)]">{error}</p>
        <Link href="/" className="mt-2 inline-block text-sm text-[var(--mint)] hover:underline">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          Home
        </Link>
        <span className="text-[var(--text-muted)]">/</span>
        <h1 className="text-xl font-bold text-[var(--text)]">Trip notes</h1>
      </div>
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        Notes you saved during your trip. Link notes to contacts and events so
        they appear in the{" "}
        <Link href="/knowledge-graph" className="text-[var(--mint)] hover:underline">
          knowledge graph
        </Link>
        .
      </p>
      {notes.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          No trip notes yet. Use the assistant or Quick note on the home page to
          add some.
        </p>
      ) : (
        <ul className="space-y-4">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-xl border border-[var(--mint-soft)] bg-[var(--cream)] p-4 text-sm text-[var(--text)]"
            >
              <p className="whitespace-pre-wrap">{note.content}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="text-[var(--text-muted)]">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
                {(note.contactIds?.length ?? 0) > 0 && (
                  <span className="text-[var(--text-muted)]">
                    Contacts:{" "}
                    {(note.contactIds ?? []).map((cid, i) => {
                      const c = contactById.get(cid);
                      const label = c ? [c.name, c.company].filter(Boolean).join(c.company ? " (" : "").concat(c.company ? ")" : "") || cid : cid;
                      return (
                        <span key={cid}>
                          {i > 0 ? ", " : null}
                          <Link href={`/contacts/${cid}`} className="text-[var(--mint)] hover:underline">
                            {label}
                          </Link>
                        </span>
                      );
                    })}
                  </span>
                )}
                {(note.eventIds?.length ?? 0) > 0 && (
                  <span className="text-[var(--text-muted)]">
                    Events:{" "}
                    {(note.eventIds ?? []).map((eid, i) => {
                      const e = eventById.get(eid);
                      const label = e ? [e.title, e.start].filter(Boolean).join(" – ") || eid : eid;
                      return (
                        <span key={eid}>
                          {i > 0 ? ", " : null}
                          <Link href={`/events/${eid}`} className="text-[var(--mint)] hover:underline">
                            {label}
                          </Link>
                        </span>
                      );
                    })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => (editingNoteId === note.id ? cancelEditing() : startEditing(note))}
                  className="text-[var(--mint)] hover:underline"
                >
                  {editingNoteId === note.id ? "Cancel" : "Edit links"}
                </button>
              </div>

              {editingNoteId === note.id && (
                <div className="mt-4 rounded-lg border border-[var(--mint-soft)] bg-[var(--bg)] p-3">
                  <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                    Link this note to contacts and events (they appear in the knowledge graph)
                  </p>
                  <div className="mb-3">
                    <span className="text-xs font-medium text-[var(--text)]">Contacts:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {contacts.length === 0 ? (
                        <span className="text-xs text-[var(--text-muted)]">No contacts yet</span>
                      ) : (
                        contacts.map((c) => {
                          const label = [c.name, c.company].filter(Boolean).join(c.company ? " (" : "").concat(c.company ? ")" : "") || c.id;
                          const checked = editContactIds.includes(c.id);
                          return (
                            <label key={c.id} className="flex cursor-pointer items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleContact(c.id)}
                                className="rounded border-[var(--mint-soft)]"
                              />
                              {label}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="mb-3">
                    <span className="text-xs font-medium text-[var(--text)]">Events:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {events.length === 0 ? (
                        <span className="text-xs text-[var(--text-muted)]">No events yet</span>
                      ) : (
                        events.map((e) => {
                          const label = [e.title, e.start].filter(Boolean).join(" – ") || e.id;
                          const checked = editEventIds.includes(e.id);
                          return (
                            <label key={e.id} className="flex cursor-pointer items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEvent(e.id)}
                                className="rounded border-[var(--mint-soft)]"
                              />
                              {label}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveLinks}
                      disabled={saving}
                      className="rounded-lg bg-[var(--mint)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save links"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="rounded-lg border border-[var(--mint-soft)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--cream)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
