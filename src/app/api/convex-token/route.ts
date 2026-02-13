import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUid } from "@/lib/workos-auth";
import { signConvexToken } from "@/lib/convex-auth";

/**
 * Returns a Convex JWT for the current user. Used by ConvexProviderWithAuth (getToken).
 * Requires WorkOS session and CONVEX_JWT_PRIVATE_KEY to be set.
 */
export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const token = await signConvexToken(uid);
    return NextResponse.json({ token });
  } catch (e) {
    console.error("[convex-token]", e);
    return NextResponse.json(
      { error: "Convex JWT not configured. Set CONVEX_JWT_PRIVATE_KEY and run Convex setup." },
      { status: 503 }
    );
  }
}
