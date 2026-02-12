"use client";

import { format, parseISO, isBefore } from "date-fns";
import type { Event } from "@/lib/types";
import Link from "next/link";

type Props = {
  events: Event[];
  maxItems?: number;
};

export function WhatsNext({ events, maxItems = 3 }: Props) {
  const now = new Date();
  const upcoming = events
    .filter((e) => {
      try {
        return isBefore(now, parseISO(e.start));
      } catch {
        return false;
      }
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, maxItems);

  if (upcoming.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-[var(--sky-soft)] bg-[var(--cream)] p-4 shadow-sm">
        <h2 className="mb-2 font-semibold text-[var(--text)]">What&apos;s next</h2>
        <p className="text-sm text-[var(--text-muted)]">No upcoming events.</p>
        <Link href="/calendar" className="mt-2 inline-block text-sm text-[var(--coral)] hover:underline">
          Open calendar
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-[var(--sky-soft)] bg-[var(--cream)] p-4 shadow-sm">
      <h2 className="mb-3 font-semibold text-[var(--text)]">What&apos;s next</h2>
      <ul className="space-y-2">
        {upcoming.map((ev) => {
          let timeStr = "";
          try {
            timeStr = format(parseISO(ev.start), "h:mm a · EEE, MMM d");
          } catch {
            timeStr = ev.start;
          }
          return (
            <li key={ev.id} className="flex flex-col gap-0.5">
              <span className="font-medium text-[var(--text)]">{ev.title}</span>
              <span className="text-sm text-[var(--text-muted)]">{timeStr}</span>
              {ev.location && (
                <span className="text-sm text-[var(--text-muted)]/80">{ev.location}</span>
              )}
            </li>
          );
        })}
      </ul>
      <Link href="/calendar" className="mt-3 inline-block text-sm text-[var(--coral)] hover:underline">
        View calendar
      </Link>
    </div>
  );
}
