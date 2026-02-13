"use client";

import { useState, useEffect, useCallback } from "react";
import type { SavedPlace } from "@/lib/types";

const DIDI_WEB_URL = "https://m.didiglobal.com";
const DIDI_APP_SCHEME = "didi://";

export default function DidiPage() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPlaces(Array.isArray(data.savedPlaces) ? data.savedPlaces : []);
      }
    } catch (e) {
      console.warn(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function addPlace(e: React.FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    const address = newAddress.trim();
    if (!label || !address) return;
    const next: SavedPlace = {
      id: crypto.randomUUID(),
      label,
      address,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...places, next];
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        savedPlaces: updated,
      }),
    });
    if (res.ok) {
      setPlaces(updated);
      setNewLabel("");
      setNewAddress("");
    }
  }

  async function deletePlace(id: string) {
    const updated = places.filter((p) => p.id !== id);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        savedPlaces: updated,
      }),
    });
    if (res.ok) setPlaces(updated);
  }

  function openDidi() {
    if (typeof window === "undefined") return;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = DIDI_APP_SCHEME;
      setTimeout(() => {
        window.open(DIDI_WEB_URL, "_blank");
      }, 500);
    } else {
      window.open(DIDI_WEB_URL, "_blank");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-[var(--text)]">Didi</h1>
      <p className="mb-4 text-[var(--text-muted)]">
        Book a ride in China. Open the Didi app or save pickup/dropoff places for quick reference.
      </p>

      <div className="mb-6">
        <button
          type="button"
          onClick={openDidi}
          className="rounded bg-[var(--mint)] px-4 py-2 font-medium text-[var(--text)] hover:opacity-90"
        >
          Open Didi
        </button>
        <p className="mt-2 text-xs text-[var(--text)]0">
          On mobile, this tries to open the Didi app; otherwise opens Didi in the browser.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-medium text-[var(--text)]">Saved places</h2>
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          Add addresses you use often (e.g. hotel, office) for quick copy-paste into Didi.
        </p>
        <form onSubmit={addPlace} className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Label (e.g. Hotel)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
          />
          <input
            type="text"
            placeholder="Address"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            className="min-w-[200px] flex-1 rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)]"
          />
          <button
            type="submit"
            className="rounded bg-[var(--mint)] px-4 py-2 text-sm text-[var(--text)] hover:opacity-90"
          >
            Add
          </button>
        </form>
        <ul className="space-y-2">
          {places.length === 0 && (
            <li className="text-sm text-[var(--text)]0">No saved places yet.</li>
          )}
          {places.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded border border-[var(--mint-soft)] bg-[var(--cream)] px-3 py-2"
            >
              <div>
                <p className="font-medium text-[var(--text)]">{p.label}</p>
                <p className="text-sm text-[var(--text-muted)]">{p.address}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(p.address);
                  }}
                  className="rounded px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--mint-soft)]"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => deletePlace(p.id)}
                  className="rounded px-2 py-1 text-sm text-[var(--coral)] hover:bg-[var(--peach)]/30"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
