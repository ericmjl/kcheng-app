import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";

async function getFinnhubKey(uid: string | null): Promise<string | null> {
  const fromEnv = process.env.FINNHUB_API_KEY;
  if (fromEnv) return fromEnv;
  if (!uid) return null;
  try {
    const client = await getConvexClient(uid);
    const settings = await client.query(api.userSettings.get);
    return (settings?.apiKeys as { finnhub?: string } | undefined)?.finnhub ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.toUpperCase().trim();
  const companyName = searchParams.get("name")?.trim();
  if (!ticker && !companyName) {
    return NextResponse.json(
      { error: "Provide ticker or name" },
      { status: 400 }
    );
  }
  const apiKey = await getFinnhubKey(uid);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Finnhub API key not configured. Add in Settings or env." },
      { status: 503 }
    );
  }
  const symbol = ticker ?? companyName ?? "";
  try {
    const [profileRes, newsRes] = await Promise.all([
      fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
      ),
      fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}&token=${apiKey}`
      ),
    ]);
    const profile = profileRes.ok ? await profileRes.json() : null;
    const news = newsRes.ok ? await newsRes.json() : [];
    const trendsSummary = {
      profile: profile
        ? {
            name: profile.name,
            country: profile.country,
            industry: profile.finnhubIndustry,
            description: profile.description?.slice(0, 500),
          }
        : null,
      news: Array.isArray(news)
        ? news.slice(0, 10).map((n: { headline?: string; summary?: string }) => ({
            headline: n.headline,
            summary: n.summary?.slice(0, 200),
          }))
        : [],
    };
    return NextResponse.json(trendsSummary);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch company data" },
      { status: 500 }
    );
  }
}
