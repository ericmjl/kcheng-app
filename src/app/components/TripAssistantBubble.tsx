"use client";

import { useState } from "react";
import { TripAssistantPanel } from "./TripAssistantPanel";
import { QuokkaAvatar } from "./QuokkaAvatar";

export function TripAssistantBubble() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TripAssistantPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--mint)] text-[var(--text)] shadow-lg transition hover:bg-[var(--mint-soft)] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[var(--mint)] focus:ring-offset-2 focus:ring-offset-[var(--wall)]"
        aria-label={isOpen ? "Close Trip Assistant" : "Open Trip Assistant"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <QuokkaAvatar size={36} aria-hidden />
        )}
      </button>
    </>
  );
}
