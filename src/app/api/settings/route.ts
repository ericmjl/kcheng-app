import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";
import type { UserSettingsDoc } from "@/lib/types";

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const client = await getConvexClient(uid);
    const data = await client.query(api.userSettings.get);
    const out: UserSettingsDoc = {
      tripStart: data?.tripStart ?? "",
      tripEnd: data?.tripEnd ?? "",
      timezone: data?.timezone ?? "Asia/Shanghai",
      apiKeys: data?.apiKeys,
      savedPlaces: data?.savedPlaces,
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const updates: {
      tripStart?: string;
      tripEnd?: string;
      timezone?: string;
      apiKeys?: { openai?: string; finnhub?: string; elevenlabs?: string };
      savedPlaces?: Array<{ id: string; label: string; address: string; createdAt: string; updatedAt: string }>;
    } = {};
    if (typeof body.tripStart === "string") updates.tripStart = body.tripStart;
    if (typeof body.tripEnd === "string") updates.tripEnd = body.tripEnd;
    if (typeof body.timezone === "string") updates.timezone = body.timezone;
    if (body.apiKeys && typeof body.apiKeys === "object") {
      updates.apiKeys = {
        openai: body.apiKeys.openai ?? undefined,
        finnhub: body.apiKeys.finnhub ?? undefined,
        elevenlabs: body.apiKeys.elevenlabs ?? undefined,
      };
    }
    if (Array.isArray(body.savedPlaces)) updates.savedPlaces = body.savedPlaces;

    const client = await getConvexClient(uid);
    await client.mutation(api.userSettings.set, updates);
    const data = await client.query(api.userSettings.get);
    const out: UserSettingsDoc = {
      tripStart: data?.tripStart ?? "",
      tripEnd: data?.tripEnd ?? "",
      timezone: data?.timezone ?? "Asia/Shanghai",
      apiKeys: data?.apiKeys,
      savedPlaces: data?.savedPlaces,
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
