"use client";

import { useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ensureAnonymousAuth, isFirebaseConfigured } from "@/lib/firebase";
import type { UIMessage } from "ai";

function getMessageDisplayText(msg: UIMessage): string {
  if (!msg.parts?.length) return "";
  return msg.parts
    .map((p) => {
      if (p.type === "text") return (p as { text: string }).text;
      if (p.type === "tool-invocation") {
        const inv = p as unknown as { toolName: string; state?: string };
        return `[Used: ${inv.toolName ?? "tool"}${inv.state === "result" ? " ✓" : ""}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

export default function AssistantPage() {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const user = await ensureAnonymousAuth();
          if (!user) return {};
          const token = await user.getIdToken();
          return { Authorization: `Bearer ${token}` };
        },
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
    if (!text || status === "streaming") return;
    setInput("");
    clearError();
    await sendMessage({ text });
  };

  if (!isFirebaseConfigured()) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-[var(--text-muted)]">
          Sign in or enable Firebase to use the assistant.
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
        on the proposal&rdquo;. I&rsquo;ll add contacts, events, and todos.
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
        {status === "streaming" && (
          <div className="mr-8 rounded-lg bg-[var(--sky-soft)] px-3 py-2 text-sm text-[var(--text-muted)]">
            …
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-[var(--coral)]">
          {error.message}
          <button
            type="button"
            onClick={clearError}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. I just met Li Wei from Tencent"
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
            disabled={!input.trim()}
            className="rounded-lg bg-[var(--mint)] px-4 py-2 font-medium text-[var(--text)] hover:bg-[var(--mint-soft)] disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </main>
  );
}
