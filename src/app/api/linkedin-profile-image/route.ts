import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUid } from "@/lib/workos-auth";

const LINKEDIN_IN_REGEX = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?/i;

/**
 * GET /api/linkedin-profile-image?url=...
 * Fetches a LinkedIn profile page and returns the og:image URL (profile headshot).
 * Only allows linkedin.com/in/ URLs.
 */
export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = request.nextUrl.searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }
  const trimmed = url.trim();
  if (!LINKEDIN_IN_REGEX.test(trimmed)) {
    return NextResponse.json({ error: "URL must be a LinkedIn profile (linkedin.com/in/...)" }, { status: 400 });
  }

  try {
    const res = await fetch(trimmed, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.linkedin.com/",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `LinkedIn returned ${res.status}` },
        { status: 502 }
      );
    }
    const html = await res.text();
    const ogImageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
      html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const imageUrl = ogImageMatch?.[1]?.trim();
    if (!imageUrl) {
      return NextResponse.json(
        { error: "No profile image found (LinkedIn may require login)" },
        { status: 404 }
      );
    }
    return NextResponse.json({ imageUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch profile";
    console.error("[linkedin-profile-image]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
