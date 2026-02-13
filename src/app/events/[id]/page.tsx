"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { Event } from "@/lib/types";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/events/${id}`, { credentials: "include" });
        if (res.ok && !cancelled) setEvent(await res.json());
        if (res.status === 404 && !cancelled) setEvent(null);
      } catch {
        if (!cancelled) setEvent(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

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
            Edit
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

      <h1 className="text-2xl font-semibold text-[var(--text)]">{event.title}</h1>

      <dl className="mt-6 space-y-3 text-sm">
        {startDate && (
          <div>
            <dt className="text-[var(--text-muted)]">Date & time</dt>
            <dd className="mt-0.5 font-medium text-[var(--text)]">
              {format(startDate, "EEEE, MMMM d, yyyy")} at {format(startDate, "h:mm a")}
              {endDate && ` – ${format(endDate, "h:mm a")}`}
            </dd>
          </div>
        )}
        {event.location && (
          <div>
            <dt className="text-[var(--text-muted)]">Location</dt>
            <dd className="mt-0.5 text-[var(--text)]">{event.location}</dd>
          </div>
        )}
        {event.contactId && (
          <div>
            <dt className="text-[var(--text-muted)]">Contact</dt>
            <dd className="mt-0.5">
              <Link
                href={`/contacts/${event.contactId}`}
                className="text-[var(--sky)] underline hover:no-underline"
              >
                View contact →
              </Link>
            </dd>
          </div>
        )}
        {event.notes && (
          <div>
            <dt className="text-[var(--text-muted)]">Notes</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-[var(--text)]">{event.notes}</dd>
          </div>
        )}
      </dl>
    </main>
  );
}
