"use client";

import { useCallback, useMemo } from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = convexUrl ? new ConvexReactClient(convexUrl) : null;

function useConvexAuthFromWorkOS() {
  const { user, loading } = useAuth();
  const fetchAccessToken = useCallback(
    async (_args: { forceRefreshToken: boolean }) => {
      const r = await fetch("/api/convex-token", { credentials: "include" });
      if (!r.ok) return null;
      const d = await r.json();
      return d.token ?? null;
    },
    []
  );
  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [loading, user, fetchAccessToken]
  );
}

export function ConvexProviderWithWorkOS({ children }: { children: React.ReactNode }) {
  if (!client) return <>{children}</>;
  return (
    <ConvexProviderWithAuth client={client} useAuth={useConvexAuthFromWorkOS}>
      {children}
    </ConvexProviderWithAuth>
  );
}
