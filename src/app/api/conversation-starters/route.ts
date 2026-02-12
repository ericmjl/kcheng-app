import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminDb } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";

async function getUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await verifyIdToken(token);
  return decoded?.uid ?? null;
}

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
      { error: "Claude API key not configured. Add in Settings or env." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const contactName = String(body.contactName ?? "").trim();
    const company = String(body.company ?? "").trim();
    const trendsSummary = body.trendsSummary ?? "";
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are helping someone prepare for a business or networking meeting in China.

Contact name: ${contactName}
Company: ${company}

Recent company context (profile and news):
${typeof trendsSummary === "string" ? trendsSummary : JSON.stringify(trendsSummary)}

Generate exactly 5 short, intelligent conversation starters or questions they can use when meeting this person. Focus on: recent company news, industry trends, and thoughtful business questions. Keep each to 1-2 sentences. Output as a JSON array of strings, e.g. ["Question 1?", "Question 2?", ...]. No other text.`,
        },
      ],
    });
    const text =
      message.content[0].type === "text"
        ? (message.content[0] as { type: "text"; text: string }).text
        : "";
    let questions: string[] = [];
    try {
      const parsed = JSON.parse(text.trim());
      questions = Array.isArray(parsed)
        ? parsed.filter((q) => typeof q === "string").slice(0, 5)
        : [];
    } catch {
      questions = text.split(/\n/).filter((l) => l.trim().length > 0).slice(0, 5);
    }
    return NextResponse.json({ questions });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to generate conversation starters" },
      { status: 500 }
    );
  }
}
