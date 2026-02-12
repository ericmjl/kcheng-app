"use client";

import type { UserSettingsDoc } from "./types";

const LOCAL_STORAGE_KEY = "china-trip-settings";

export function getLocalSettings(): Partial<UserSettingsDoc> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setLocalSettings(settings: Partial<UserSettingsDoc>) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalSettings();
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ ...current, ...settings })
    );
  } catch {
    // ignore
  }
}
