"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("SW registered", reg.scope);
      })
      .catch((e) => {
        console.warn("SW registration failed", e);
      });
  }, []);
  return null;
}
