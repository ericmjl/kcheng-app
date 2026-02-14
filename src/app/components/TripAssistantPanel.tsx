"use client";

import { TripAssistantChat } from "./TripAssistantChat";
import { QuokkaAvatar } from "./QuokkaAvatar";

interface TripAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TripAssistantPanel({ isOpen, onClose }: TripAssistantPanelProps) {
  return (
    <>
      {/* Backdrop — hidden when closed so panel stays mounted and chat state persists */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={`fixed bottom-0 right-0 z-50 flex h-[min(85vh,32rem)] w-full max-w-md flex-col rounded-t-2xl border border-[var(--mint-soft)] bg-[var(--cream)] shadow-2xl transition-[transform,opacity] duration-200 ease-out sm:bottom-6 sm:right-6 sm:h-[28rem] sm:max-h-[calc(100vh-6rem)] sm:rounded-2xl ${
          isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
        role="dialog"
        aria-label="Trip Assistant"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--mint-soft)] bg-[var(--cream)]/95 px-4 py-3">
          <div className="flex items-center gap-2">
            <QuokkaAvatar size={32} aria-hidden />
            <h2 className="text-base font-semibold text-[var(--text)]">Trip Assistant</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
            aria-label="Close assistant"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body: shared chat UI */}
        <TripAssistantChat />
      </aside>
    </>
  );
}
