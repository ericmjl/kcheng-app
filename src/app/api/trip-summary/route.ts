import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";
import { getOpenAIKey } from "@/lib/llm-keys";
import { generateTripSummaryContent } from "@/lib/generate-trip-summary";

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const openaiKey = await getOpenAIKey(uid);
  if (!openaiKey) {
    return NextResponse.json(
      { error: "Add an OpenAI API key in Settings for trip summary." },
      { status: 503 }
    );
  }

  try {
    const client = await getConvexClient(uid);
    const summary = await generateTripSummaryContent(client, openaiKey);
    const now = new Date().toISOString();
    await client.mutation(api.userSettings.set, {
      tripSummary: summary,
      tripSummaryUpdatedAt: now,
    });
    return NextResponse.json({ summary, updatedAt: now });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to generate trip summary" },
      { status: 500 }
    );
  }
}
