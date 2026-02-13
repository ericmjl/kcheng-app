import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getUid } from "@/lib/workos-auth";
import OpenAI from "openai";

async function getOpenAIKey(uid: string | null): Promise<string | null> {
  const fromEnv = process.env.OPENAI_API_KEY;
  if (fromEnv) return fromEnv;
  if (!uid) return null;
  const db = getAdminDb();
  if (!db) return null;
  const doc = await db.collection("userSettings").doc(uid).get();
  const data = doc.data();
  return (data?.apiKeys as { openai?: string } | undefined)?.openai ?? null;
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const apiKey = await getOpenAIKey(uid);
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured. Add in Settings or env for Whisper." },
      { status: 503 }
    );
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }
    const openai = new OpenAI({ apiKey });
    const transcript = await openai.audio.transcriptions.create({
      file: new Blob([await file.arrayBuffer()], { type: file.type || "audio/webm" }),
      model: "whisper-1",
    });
    const text = transcript.text ?? "";
    return NextResponse.json({ transcript: text });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
