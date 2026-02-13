"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useVoiceRecordTranscribe } from "@/hooks/useVoiceRecordTranscribe";
import type { UIMessage } from "ai";

function getMessageDisplayText(msg: UIMessage): string {
  if (!msg.parts?.length) return "";
  const parts = msg.parts
    .map((p) => {
      if (p.type === "text") return (p as { text: string }).text;
      if (p.type === "file") return "[file attached]";
      if (p.type === "tool-invocation") {
        const inv = p as unknown as { toolName: string; state?: string };
        return `[Used: ${inv.toolName ?? "tool"}${inv.state === "result" ? " ✓" : ""}]`;
      }
      return "";
    })
    .filter(Boolean);
  return parts.join(" ");
}

const ACCEPT_FILES = ".xlsx,.xls,.docx,.doc";

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 ${listening ? "text-[var(--coral)]" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

interface TripAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function voiceErrorMessage(error: string | null): string {
  switch (error) {
    case "not-allowed":
      return "Microphone access was denied. Allow mic in your browser to use voice input.";
    case "no-audio":
      return "No audio was captured. Try speaking and recording again.";
    case "transcribe-failed":
      return "Transcription failed. Check your connection and try again.";
    case "no-api-key":
      return "Add an OpenAI API key in Settings for voice fallback (Whisper).";
    case "unsupported":
      return "Voice recording isn’t supported in this browser. Try Chrome or Safari.";
    default:
      return "";
  }
}

export function TripAssistantPanel({ isOpen, onClose }: TripAssistantPanelProps) {
  const { user, loading: authLoading } = useAuth();
  const [input, setInput] = useState("");
  const [fileList, setFileList] = useState<FileList | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const onTranscribed = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}`.trim() : text));
  }, []);

  const {
    isSupported: isVoiceSupported,
    isRecording,
    isTranscribing,
    error: voiceError,
    startRecording,
    stopRecording,
    clearError: clearVoiceError,
  } = useVoiceRecordTranscribe({ onTranscribed });

  const isVoiceActive = isRecording || isTranscribing;

  const handleVoiceToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      clearVoiceError();
      startRecording();
    }
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        credentials: "include",
      }),
    []
  );

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    clearError,
  } = useChat({
    transport,
  });

  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const wasStreaming = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    const isDone = status !== "streaming" && status !== "submitted";
    if (wasStreaming && isDone) {
      window.dispatchEvent(new CustomEvent("trip-assistant:data-changed"));
    }
    prevStatusRef.current = status;
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    const files = fileList ?? undefined;
    if ((!text && !files?.length) || status === "streaming") return;
    setInput("");
    setFileList(null);
    clearError();
    if (files?.length) {
      await sendMessage({ text: text || "Please add the contacts, events, or todos from this file.", files });
    } else {
      await sendMessage({ text });
    }
  };

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
          <h2 className="text-base font-semibold text-[var(--text)]">Trip Assistant</h2>
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

        {/* Body: auth gate or chat */}
        <div className="flex min-h-0 flex-1 flex-col">
          {!authLoading && !user ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              <p>
                <a href="/auth/signin" className="underline hover:text-[var(--text)]">Sign in</a> to use the assistant.
              </p>
            </div>
          ) : (
            <>
              <p className="shrink-0 px-4 pt-2 text-xs text-[var(--text-muted)]">
                Type or use the mic: &ldquo;Meeting Jane Tuesday 3pm at the hotel&rdquo;. Or attach an Excel/Word file.
              </p>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="flex flex-col gap-2">
                  {messages.length === 0 && (
                    <p className="text-sm text-[var(--text-muted)]">Send a message to get started.</p>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "ml-6 bg-[var(--mint)] text-[var(--text)]"
                          : msg.role === "assistant"
                            ? "mr-6 bg-[var(--sky-soft)] text-[var(--text)]"
                            : "hidden"
                      }`}
                    >
                      {msg.role !== "system" && getMessageDisplayText(msg)}
                    </div>
                  ))}
                  {(status === "streaming" || status === "submitted") && (
                    <div className="mr-6 rounded-lg bg-[var(--sky-soft)] px-3 py-2 text-sm text-[var(--text-muted)]">
                      {status === "submitted" ? "Sending…" : "…"}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="shrink-0 border-t border-[var(--coral)]/30 bg-[var(--coral)]/10 px-4 py-2 text-sm">
                  <p className="font-medium text-[var(--coral)]">Something went wrong</p>
                  <p className="mt-0.5">
                    {(() => {
                      try {
                        const parsed = JSON.parse(error.message) as { error?: string };
                        return parsed.error ?? error.message;
                      } catch {
                        return error.message;
                      }
                    })()}
                  </p>
                  <button type="button" onClick={clearError} className="mt-1 text-[var(--coral)] underline">
                    Dismiss
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="shrink-0 border-t border-[var(--mint-soft)] bg-[var(--cream)] p-3">
                {voiceError && voiceErrorMessage(voiceError) && (
                  <p className="mb-2 text-xs text-[var(--coral)]" role="alert">
                    {voiceErrorMessage(voiceError)}
                  </p>
                )}
                {(isRecording || isTranscribing) && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]" aria-live="polite">
                    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[var(--coral)]" aria-hidden />
                    {isTranscribing ? "Transcribing…" : "Recording… Speak then tap the mic again to stop."}
                  </p>
                )}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--mint-soft)]">
                    Attach file
                    <input
                      type="file"
                      accept={ACCEPT_FILES}
                      multiple
                      className="hidden"
                      onChange={(e) => setFileList(e.target.files ?? null)}
                      disabled={status === "streaming"}
                    />
                  </label>
                  {fileList?.length ? (
                    <span className="text-xs text-[var(--text-muted)]">
                      {fileList.length} file{fileList.length !== 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g. Meeting Li Wei Tuesday 3pm…"
                    className="flex-1 rounded-lg border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--mint)] focus:outline-none"
                    disabled={status === "streaming"}
                    aria-label="Message"
                  />
                  {hasMounted && isVoiceSupported && status !== "streaming" && (
                    <button
                      type="button"
                      onClick={handleVoiceToggle}
                      className={`flex shrink-0 items-center justify-center rounded-lg px-3 py-2 transition-colors ${
                        isRecording
                          ? "bg-[var(--coral)]/25 text-[var(--coral)] hover:bg-[var(--coral)]/35"
                          : "bg-[var(--wall)] text-[var(--text-muted)] hover:bg-[var(--mint-soft)] hover:text-[var(--text)]"
                      }`}
                      aria-label={isRecording ? "Stop recording" : "Start voice input"}
                      aria-pressed={isRecording}
                      title={isRecording ? "Stop recording" : "Record voice (transcribed via OpenAI Whisper)"}
                    >
                      <MicIcon listening={isRecording} />
                    </button>
                  )}
                  {status === "streaming" ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="rounded-lg bg-[var(--coral)]/20 px-3 py-2 text-sm font-medium text-[var(--text)]"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={(!input.trim() && !fileList?.length) || isVoiceActive}
                      className="rounded-lg bg-[var(--mint)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--mint-soft)] disabled:opacity-50"
                    >
                      Send
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
