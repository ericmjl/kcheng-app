"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useVoiceRecordTranscribe } from "@/hooks/useVoiceRecordTranscribe";
import type { UIMessage } from "ai";

type ContactChoice = { id: string; name: string; company?: string };

/** Contact from API for @-mention list */
type ContactForMention = { id: string; name: string; company?: string };

const RESOLVED_CONTACTS_PREFIX = "\n\n[Resolved contacts - use these ids directly, do not ask to confirm:";
const RESOLVED_CONTACTS_SUFFIX = "]";

function stripResolvedContactsLine(text: string): string {
  const idx = text.indexOf(RESOLVED_CONTACTS_PREFIX);
  if (idx === -1) return text;
  return text.slice(0, idx).trimEnd();
}

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
  const raw = parts.join(" ");
  return msg.role === "user" ? stripResolvedContactsLine(raw) : raw;
}

/** If the assistant message contains a findContactsByName result with contacts, return them for disambiguation UI. */
function getContactChoicesFromMessage(msg: UIMessage): ContactChoice[] | null {
  if (msg.role !== "assistant" || !msg.parts?.length) return null;
  for (const p of msg.parts) {
    const part = p as unknown as { type?: string; toolName?: string; state?: string; result?: { contacts?: ContactChoice[] }; output?: { contacts?: ContactChoice[] } };
    const isFindContacts = part.type === "tool-invocation" && part.toolName === "findContactsByName"
      || part.type === "tool-findContactsByName";
    const hasResult = part.state === "result" || part.state === "output-available" || part.result != null || part.output != null;
    if (isFindContacts && hasResult) {
      const contacts = part.result?.contacts ?? part.output?.contacts;
      if (Array.isArray(contacts) && contacts.length > 0) return contacts;
    }
  }
  return null;
}

const ACCEPT_FILES = ".xlsx,.xls,.docx,.doc,image/*";

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
      return "Voice recording isn't supported in this browser. Try Chrome or Safari.";
    default:
      return "";
  }
}

const MAX_MENTION_SUGGESTIONS = 8;

export function TripAssistantChat() {
  const { user, loading: authLoading } = useAuth();
  const [input, setInput] = useState("");
  const [fileList, setFileList] = useState<FileList | null>(null);
  const isClient = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [contacts, setContacts] = useState<ContactForMention[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const [resolvedContactsForMessage, setResolvedContactsForMessage] = useState<ContactForMention[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load contacts for @-mentions when user is logged in
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/contacts", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setContacts(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

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

  // Filter contacts for @-mention dropdown
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.trim().toLowerCase();
    return contacts
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.company && c.company.toLowerCase().includes(q)))
      .slice(0, MAX_MENTION_SUGGESTIONS);
  }, [contacts, mentionQuery]);

  const updateMentionState = useCallback((value: string, cursorPosition: number) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const lastAt = beforeCursor.lastIndexOf("@");
    if (lastAt === -1) {
      setMentionQuery(null);
      return;
    }
    const afterAt = beforeCursor.slice(lastAt + 1);
    if (/\s/.test(afterAt)) {
      setMentionQuery(null);
      return;
    }
    setMentionStart(lastAt);
    setMentionQuery(afterAt);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart ?? value.length;
    setInput(value);
    updateMentionState(value, cursor);
  }, [updateMentionState]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null && e.key === "Escape") {
      setMentionQuery(null);
      e.preventDefault();
    }
  }, [mentionQuery]);

  const pickMention = useCallback((contact: ContactForMention) => {
    const el = inputRef.current;
    if (!el) return;
    const start = mentionStart;
    const end = start + 1 + (mentionQuery?.length ?? 0);
    const before = input.slice(0, start);
    const after = input.slice(end);
    const name = contact.name;
    const next = `${before}${name} ${after}`;
    setInput(next);
    setMentionQuery(null);
    setResolvedContactsForMessage((prev) => (prev.some((c) => c.id === contact.id) ? prev : [...prev, contact]));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + name.length + 1;
      el.setSelectionRange(pos, pos);
    });
  }, [input, mentionStart, mentionQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let text = input.trim();
    const files = fileList ?? undefined;
    if ((!text && !files?.length) || status === "streaming") return;
    if (text && resolvedContactsForMessage.length > 0) {
      const resolvedLine = resolvedContactsForMessage
        .map((c) => `${c.name} (id: ${c.id})`)
        .join(", ");
      text = `${text}${RESOLVED_CONTACTS_PREFIX} ${resolvedLine}${RESOLVED_CONTACTS_SUFFIX}`;
    }
    setInput("");
    setFileList(null);
    setMentionQuery(null);
    setResolvedContactsForMessage([]);
    clearError();
    if (files?.length) {
      await sendMessage({ text: text || "Please add the contacts, events, or todos from this file.", files });
    } else {
      await sendMessage({ text });
    }
  };

  return (
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
            Type or use the mic: &ldquo;Meeting Jane Tuesday 3pm at the hotel&rdquo;. Or attach a file (Excel, Word, or photo).
          </p>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="flex flex-col gap-2">
              {messages.length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">Send a message to get started.</p>
              )}
              {messages.map((msg) => {
                const contactChoices = getContactChoicesFromMessage(msg);
                return (
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
                    {msg.role === "assistant" && contactChoices && contactChoices.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-[var(--text-muted)]">Which contact is this meeting with?</p>
                        <div className="flex flex-wrap gap-2">
                          {contactChoices.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => sendMessage({ text: c.company ? `Use contact ${c.name} (${c.company})` : `Use contact ${c.name}` })}
                              disabled={status === "streaming"}
                              className="rounded-lg border border-[var(--mint-soft)] bg-[var(--wall)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--mint-soft)] disabled:opacity-50"
                            >
                              {c.name}
                              {c.company ? ` (${c.company})` : ""}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => sendMessage({ text: "Create new contact" })}
                            disabled={status === "streaming"}
                            className="rounded-lg border border-dashed border-[var(--mint-soft)] bg-transparent px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--mint-soft)]/50 disabled:opacity-50"
                          >
                            Create new contact
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                {mentionSuggestions.length > 0 && (
                  <div
                    id="trip-assistant-mention-list"
                    className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--mint-soft)] bg-[var(--cream)] shadow-lg"
                    role="listbox"
                    aria-label="Suggest contacts"
                  >
                    {mentionSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                            aria-selected={false}
                            onClick={() => pickMention(c)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--mint-soft)] focus:bg-[var(--mint-soft)] focus:outline-none"
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.company && <span className="text-[var(--text-muted)]">({c.company})</span>}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder="e.g. Meeting Li Wei Tuesday 3pm… or type @ to mention a contact"
                  className="w-full rounded-lg border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--mint)] focus:outline-none"
                  disabled={status === "streaming"}
                  aria-label="Message"
                  aria-autocomplete="list"
                  aria-controls={mentionSuggestions.length > 0 ? "trip-assistant-mention-list" : undefined}
                />
              </div>
              {isClient && isVoiceSupported && status !== "streaming" && (
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
  );
}
