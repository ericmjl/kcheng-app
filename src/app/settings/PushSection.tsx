"use client";

import { useState, useEffect } from "react";
import { ensureAnonymousAuth, isFirebaseConfigured } from "@/lib/firebase";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSection() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        !!vapidKey
    );
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setSubscribed(!!sub);
        });
      });
    }
  }, [vapidKey]);

  async function subscribe() {
    if (!vapidKey || !supported) return;
    setLoading(true);
    try {
      let reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await reg.update();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const serialized = JSON.parse(JSON.stringify(sub));
      if (isFirebaseConfigured()) {
        const user = await ensureAnonymousAuth();
        if (user) {
          const token = await user.getIdToken();
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ subscription: serialized }),
          });
        }
      }
      setSubscribed(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-medium text-[var(--text)]">Reminders</h2>
      <p className="mb-3 text-sm text-[var(--text-muted)]">
        Get push notifications for upcoming events (e.g. &quot;Meeting in 30 min&quot;). Works on iPhone when the app is added to Home Screen (iOS 16.4+).
      </p>
      {subscribed ? (
        <p className="text-sm text-[var(--coral)]">Push reminders are enabled.</p>
      ) : (
        <button
          type="button"
          onClick={subscribe}
          disabled={loading}
          className="rounded bg-[var(--mint)] px-3 py-2 text-sm text-[var(--text)] hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Enabling…" : "Enable push reminders"}
        </button>
      )}
    </section>
  );
}
