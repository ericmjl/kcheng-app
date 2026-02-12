"use client";

import { useState, useEffect, useCallback } from "react";
import { ensureAnonymousAuth, isFirebaseConfigured } from "@/lib/firebase";
import { getLocalSettings, setLocalSettings } from "@/lib/settings";
import type { UserSettingsDoc } from "@/lib/types";
import { PushSection } from "./PushSection";

export default function SettingsPage() {
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [apiKeys, setApiKeys] = useState<{
    anthropic?: string;
    openai?: string;
    finnhub?: string;
  }>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const local = getLocalSettings();
    setTripStart(local.tripStart ?? "");
    setTripEnd(local.tripEnd ?? "");
    setTimezone(local.timezone ?? "Asia/Shanghai");
    setApiKeys(local.apiKeys ?? {});

    if (isFirebaseConfigured()) {
      try {
        const user = await ensureAnonymousAuth();
        if (user) {
          const token = await user.getIdToken();
          const res = await fetch("/api/settings", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setTripStart(data.tripStart ?? "");
            setTripEnd(data.tripEnd ?? "");
            setTimezone(data.timezone ?? "Asia/Shanghai");
            setApiKeys(data.apiKeys ?? {});
            setFirebaseReady(true);
          }
        }
      } catch (e) {
        console.warn("Firebase load failed, using local", e);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const payload: Partial<UserSettingsDoc> = {
      tripStart,
      tripEnd,
      timezone,
      apiKeys: {
        anthropic: apiKeys.anthropic || undefined,
        openai: apiKeys.openai || undefined,
        finnhub: apiKeys.finnhub || undefined,
      },
    };

    setLocalSettings(payload);

    if (isFirebaseConfigured()) {
      try {
        const user = await ensureAnonymousAuth();
        if (user) {
          const token = await user.getIdToken();
          const res = await fetch("/api/settings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error("Save failed");
        }
      } catch (err) {
        console.error(err);
        setSaved(false);
        return;
      }
    }
    setSaved(true);
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
      {!isFirebaseConfigured() && (
        <p className="mb-4 rounded-lg border border-[var(--peach)] bg-[var(--peach)]/20 p-3 text-sm text-[var(--text)]">
          Add Firebase env vars (NEXT_PUBLIC_FIREBASE_*) and server credentials
          (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) to
          sync settings across devices. Until then, settings are saved locally.
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
            Optional: set in Vercel env vars instead (ANTHROPIC_API_KEY,
            OPENAI_API_KEY, FINNHUB_API_KEY). If you paste here, they are stored
            in your account (Firebase) or locally.
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">
                Claude (Anthropic)
              </label>
              <input
                type="password"
                placeholder="sk-ant-…"
                value={apiKeys.anthropic ?? ""}
                onChange={(e) =>
                  setApiKeys((k) => ({ ...k, anthropic: e.target.value }))
                }
                className="w-full rounded-lg border-2 border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">
                OpenAI (Whisper)
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
