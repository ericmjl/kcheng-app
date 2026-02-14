import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";

const CACHE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (matches LinkedIn photo TTL)

/**
 * GET /api/contacts/[id]/photo
 * Proxies the contact's photoUrl (e.g. LinkedIn) so the browser can load it
 * without hotlink blocking. Caches for 30 days.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = (await params).id;
  const client = await getConvexClient(uid);
  const contact = await client.query(api.contacts.get, { id: id as any });
  if (!contact || contact.userId !== uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const photoUrl = contact.photoUrl?.trim();
  if (!photoUrl) {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (photoUrl.includes("linkedin.com") || photoUrl.includes("licdn.com")) {
      headers["Referer"] = "https://www.linkedin.com/";
    }
    const res = await fetch(photoUrl, { headers, redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Image fetch failed: ${res.status}` },
        { status: 502 }
      );
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=86400`,
      },
    });
  } catch (e) {
    console.error("[contacts/photo]", e);
    return NextResponse.json(
      { error: "Failed to load image" },
      { status: 502 }
    );
  }
}
