import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUid } from "@/lib/workos-auth";
import { getOpenAIKey } from "@/lib/llm-keys";
import OpenAI from "openai";

const SUMMARIZE_PROMPT = (transcript: string) =>
  `Below is a meeting transcript. Provide:
1. A short summary (2-4 sentences).
2. A list of action items (who does what, or follow-ups).

Format your response as JSON only, with exactly two keys: "summary" (string) and "actionItems" (array of strings). No other text.

Transcript:
${transcript.slice(0, 50000)}`;

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const openaiKey = await getOpenAIKey(uid);
  if (!openaiKey) {
    return NextResponse.json(
      { error: "Add an OpenAI API key in Settings or set OPENAI_API_KEY for summarization." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const transcript = String(body.transcript ?? "").trim();
    if (!transcript) {
      return NextResponse.json({ error: "transcript required" }, { status: 400 });
    }

    const prompt = SUMMARIZE_PROMPT(transcript);
    let text = "";

    const openai = new OpenAI({ apiKey: openaiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    text = completion.choices[0]?.message?.content ?? "";

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
