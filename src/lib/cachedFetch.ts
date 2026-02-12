"use client";

import { get, set } from "idb-keyval";

const CACHE_PREFIX = "china-trip-cache:";

export async function cachedGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher();
    await set(CACHE_PREFIX + key, { data, at: Date.now() });
    return data;
  } catch (e) {
    const cached = await get<{ data: T; at: number }>(CACHE_PREFIX + key);
    if (cached?.data != null) return cached.data;
    throw e;
  }
}

export async function getCachedOnly<T>(key: string): Promise<T | null> {
  const cached = await get<{ data: T }>(CACHE_PREFIX + key);
  return cached?.data ?? null;
}
