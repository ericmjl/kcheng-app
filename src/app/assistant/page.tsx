"use client";

import { useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
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

export default function AssistantPage() {
  const { user, loading: authLoading } = useAuth();
  const [input, setInput] = useState("");
  const [fileList, setFileList] = useState<FileList | null>(null);

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

  if (!authLoading && !user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-[var(--text-muted)]">
          <a href="/auth/signin" className="underline hover:text-[var(--text)]">Sign in</a> to use the assistant.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-[var(--text)]">
        Trip assistant
      </h1>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Say things like: &ldquo;I just met John from Acme&rdquo;, &ldquo;Meeting
        Jane on Tuesday at 3pm at the hotel&rdquo;, or &ldquo;Follow up with John
        on the proposal&rdquo;. You can also attach an <strong>Excel</strong> or{" "}
        <strong>Word</strong> file and I&rsquo;ll parse it into contacts, events,
        and todos.
      </p>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-[var(--mint-soft)] bg-[var(--cream)]/80 p-4 shadow-inner">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">
            Send a message to get started.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "ml-8 bg-[var(--mint)] text-[var(--text)]"
                : msg.role === "assistant"
                  ? "mr-8 bg-[var(--sky-soft)] text-[var(--text)]"
                  : "hidden"
            }`}
          >
            {msg.role !== "system" && getMessageDisplayText(msg)}
          </div>
        ))}
        {(status === "streaming" || status === "submitted") && (
          <div className="mr-8 rounded-lg bg-[var(--sky-soft)] px-3 py-2 text-sm text-[var(--text-muted)]">
            {status === "submitted" ? "Sending…" : "…"}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-[var(--coral)] bg-[var(--coral)]/10 px-4 py-3 text-sm text-[var(--text)]">
          <p className="font-medium text-[var(--coral)]">Something went wrong</p>
          <p className="mt-1">
            {(() => {
              try {
                const parsed = JSON.parse(error.message) as { error?: string };
                return parsed.error ?? error.message;
              } catch {
                return error.message;
              }
            })()}
          </p>
          {error.message.includes("Claude API key") || error.message.includes("ANTHROPIC") ? (
            <p className="mt-2 text-[var(--text-muted)]">
              Add <code className="rounded bg-black/10 px-1">ANTHROPIC_API_KEY</code> to your <code className="rounded bg-black/10 px-1">.env.local</code>, or paste your Claude API key in Settings in the app.
            </p>
          ) : null}
          <button
            type="button"
            onClick={clearError}
            className="mt-2 text-[var(--coral)] underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]">
            <span className="hidden sm:inline">Attach Excel/Word</span>
            <span className="sm:hidden">Attach file</span>
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
            <span className="text-sm text-[var(--text-muted)]">
              {fileList.length} file{fileList.length !== 1 ? "s" : ""} selected
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. I just met Li Wei from Tencent, or add these from the file"
            className="flex-1 rounded-lg border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--mint)] focus:outline-none"
            disabled={status === "streaming"}
          />
          {status === "streaming" ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg bg-[var(--coral)]/20 px-4 py-2 font-medium text-[var(--text)] hover:bg-[var(--coral)]/30"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() && !fileList?.length}
              title={!input.trim() && !fileList?.length ? "Type a message or attach a file to send" : undefined}
              className="rounded-lg bg-[var(--mint)] px-4 py-2 font-medium text-[var(--text)] hover:bg-[var(--mint-soft)] disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
