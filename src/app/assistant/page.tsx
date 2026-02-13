"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Assistant is now a floating bubble on every page.
 * Redirect /assistant to home so old links and bookmarks still work.
 */
export default function AssistantRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <main className="flex min-h-[40vh] items-center justify-center px-4">
      <p className="text-sm text-[var(--text-muted)]">Redirecting…</p>
    </main>
  );
}
