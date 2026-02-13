"use client";

import { useState, useEffect, useCallback } from "react";
import { getLocalSettings, setLocalSettings } from "@/lib/settings";
import type { UserSettingsDoc } from "@/lib/types";
import { PushSection } from "./PushSection";

export default function SettingsPage() {
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [apiKeys, setApiKeys] = useState<{
    openai?: string;
    finnhub?: string;
    elevenlabs?: string;
  }>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverReady, setServerReady] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const local = getLocalSettings();
    setTripStart(local.tripStart ?? "");
    setTripEnd(local.tripEnd ?? "");
    setTimezone(local.timezone ?? "Asia/Shanghai");
    setApiKeys(local.apiKeys ?? {});
    try {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTripStart(data.tripStart ?? "");
        setTripEnd(data.tripEnd ?? "");
        setTimezone(data.timezone ?? "Asia/Shanghai");
        setApiKeys(data.apiKeys ?? {});
        setServerReady(true);
      }
    } catch (e) {
      console.warn("Settings load failed, using local", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSaveError(null);
    const payload: Partial<UserSettingsDoc> = {
      tripStart,
      tripEnd,
      timezone,
      apiKeys: {
        openai: apiKeys.openai || undefined,
        finnhub: apiKeys.finnhub || undefined,
        elevenlabs: apiKeys.elevenlabs || undefined,
      },
    };

    setLocalSettings(payload);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        const message = data.error ?? `Save failed (${res.status})`;
        setSaveError(res.status === 401 ? "Sign in to save trip dates to your account." : message);
        return;
      }
      setSaved(true);
    } catch (err) {
      console.error(err);
      setSaveError("Network or server error. Your settings were saved locally.");
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-[var(--text-muted)]">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--text)]">Settings</h1>
      {!serverReady && (
        <p className="mb-4 rounded-lg border border-[var(--peach)] bg-[var(--peach)]/20 p-3 text-sm text-[var(--text)]">
          Sign in to sync settings across devices. Until then, settings are saved locally.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <section>
          <h2 className="mb-3 text-lg font-medium text-[var(--text)]">
            Trip dates (China)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">
                Start date
              </label>
              <input
                type="date"
                value={tripStart}
                onChange={(e) => setTripStart(e.target.value)}
                className="w-full rounded-lg border-2 border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">
                End date
              </label>
              <input
                type="date"
                value={tripEnd}
                onChange={(e) => setTripEnd(e.target.value)}
                className="w-full rounded-lg border-2 border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)]"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border-2 border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)]"
            >
              <option value="Asia/Shanghai">Asia/Shanghai</option>
              <option value="Asia/Hong_Kong">Asia/Hong_Kong</option>
              <option value="Asia/Chongqing">Asia/Chongqing</option>
            </select>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-[var(--text)]">API keys</h2>
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            Optional: set in Vercel env vars instead (OPENAI_API_KEY,
            FINNHUB_API_KEY). If you paste here, they are stored in your account
            or locally.
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">
                OpenAI (chat, conversation starters, meeting summaries)
              </label>
              <input
                type="password"
                placeholder="sk-…"
                value={apiKeys.openai ?? ""}
                onChange={(e) =>
                  setApiKeys((k) => ({ ...k, openai: e.target.value }))
                }
                className="w-full rounded-lg border-2 border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">
                ElevenLabs (voice transcription)
              </label>
              <input
                type="password"
                placeholder="API key from elevenlabs.io"
                value={apiKeys.elevenlabs ?? ""}
                onChange={(e) =>
                  setApiKeys((k) => ({ ...k, elevenlabs: e.target.value }))
                }
                className="w-full rounded-lg border-2 border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">
                Finnhub (company trends)
              </label>
              <input
                type="password"
                placeholder="API key"
                value={apiKeys.finnhub ?? ""}
                onChange={(e) =>
                  setApiKeys((k) => ({ ...k, finnhub: e.target.value }))
                }
                className="w-full rounded-lg border-2 border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
              />
            </div>
          </div>
        </section>

        {saveError && (
          <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral)]/10 px-4 py-3 text-sm text-[var(--text)]">
            <p className="font-medium text-[var(--coral)]">Couldn’t save to account</p>
            <p className="mt-1">{saveError}</p>
          </div>
        )}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded-lg bg-[var(--mint)] px-4 py-2 font-medium text-[var(--text)] hover:opacity-90"
          >
            Save
          </button>
          {saved && (
            <span className="text-sm text-[var(--coral)]">Settings saved.</span>
          )}
        </div>
      </form>
      <PushSection />
    </div>
  );
}
