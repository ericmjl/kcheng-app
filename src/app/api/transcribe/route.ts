import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConvexClient, api } from "@/lib/convex-server";
import { getUid } from "@/lib/workos-auth";
import OpenAI, { toFile } from "openai";

async function getOpenAIKey(uid: string | null): Promise<string | null> {
  const fromEnv = process.env.OPENAI_API_KEY;
  if (fromEnv) return fromEnv;
  if (!uid) return null;
  try {
    const client = await getConvexClient(uid);
    const settings = await client.query(api.userSettings.get);
    return (settings?.apiKeys as { openai?: string } | undefined)?.openai ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getOpenAIKey(uid);
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured. Add in Settings or set OPENAI_API_KEY for voice fallback." },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await toFile(buffer, file.name || "recording.webm", {
      type: file.type || "audio/webm",
    });

    const openai = new OpenAI({ apiKey });
    const transcript = await openai.audio.transcriptions.create({
      file: upload,
      model: "whisper-1",
    });
    const text = (transcript.text ?? "").trim();
    return NextResponse.json({ transcript: text });
  } catch (e) {
    console.error("[transcribe]", e);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
