import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getUid } from "@/lib/workos-auth";
import Anthropic from "@anthropic-ai/sdk";

async function getClaudeKey(uid: string | null): Promise<string | null> {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return fromEnv;
  if (!uid) return null;
  const db = getAdminDb();
  if (!db) return null;
  const doc = await db.collection("userSettings").doc(uid).get();
  const data = doc.data();
  return (data?.apiKeys as { anthropic?: string } | undefined)?.anthropic ?? null;
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const apiKey = await getClaudeKey(uid);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Claude API key not configured" },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const transcript = String(body.transcript ?? "").trim();
    if (!transcript) {
      return NextResponse.json({ error: "transcript required" }, { status: 400 });
    }
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Below is a meeting transcript. Provide:
1. A short summary (2-4 sentences).
2. A list of action items (who does what, or follow-ups).

Format your response as JSON only, with exactly two keys: "summary" (string) and "actionItems" (array of strings). No other text.

Transcript:
${transcript.slice(0, 50000)}`,
        },
      ],
    });
    const text =
      message.content[0].type === "text"
        ? (message.content[0] as { type: "text"; text: string }).text
        : "";
    let summary = "";
    let actionItems: string[] = [];
    try {
      const parsed = JSON.parse(text.trim());
      summary = typeof parsed.summary === "string" ? parsed.summary : "";
      actionItems = Array.isArray(parsed.actionItems)
        ? parsed.actionItems.filter((x: unknown) => typeof x === "string")
        : [];
    } catch {
      summary = text.slice(0, 500);
    }
    return NextResponse.json({ summary, actionItems });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Summarization failed" },
      { status: 500 }
    );
  }
}
