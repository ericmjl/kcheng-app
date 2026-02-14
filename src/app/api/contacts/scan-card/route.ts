import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUid } from "@/lib/workos-auth";
import { getOpenAIKey } from "@/lib/llm-keys";
import OpenAI from "openai";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const SCAN_SYSTEM_PROMPT = `You are given a photo of a business card. Extract contact information and return a single JSON object with only these string fields (use empty string or omit if not found): name, company, role, phone, email, notes, stockTicker, pronouns. No other keys. Normalize phone and email (digits only for phone if helpful; keep email as-is).`;

type ParsedContact = {
  name?: string;
  company?: string;
  role?: string;
  phone?: string;
  email?: string;
  notes?: string;
  stockTicker?: string;
  pronouns?: string;
};

const ALLOWED_KEYS: (keyof ParsedContact)[] = [
  "name",
  "company",
  "role",
  "phone",
  "email",
  "notes",
  "stockTicker",
  "pronouns",
];

function sanitize(parsed: unknown): ParsedContact {
  if (parsed === null || typeof parsed !== "object") return {};
  const out: ParsedContact = {};
  const obj = parsed as Record<string, unknown>;
  for (const key of ALLOWED_KEYS) {
    const v = obj[key];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) out[key] = s;
  }
  return out;
}

export async function POST(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getOpenAIKey(uid);
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OpenAI API key not configured. Add in Settings or set OPENAI_API_KEY.",
      },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ error: "No image file" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image too large (max 10 MB)" },
        { status: 400 }
      );
    }
    const type = (file.type || "").toLowerCase();
    const allowed =
      type.startsWith("image/") || ALLOWED_TYPES.includes(type);
    if (!allowed) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, or WebP." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mime = type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64}`;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SCAN_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 512,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw || typeof raw !== "string") {
      return NextResponse.json(
        { error: "No response from vision model" },
        { status: 500 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json(
        { error: "Failed to parse extracted data" },
        { status: 500 }
      );
    }

    const contact = sanitize(parsed);
    if (!contact.name?.trim()) contact.name = "";

    return NextResponse.json({ contact });
  } catch (e) {
    console.error("[scan-card]", e);
    return NextResponse.json(
      { error: "Scan failed. Try another image or check your API key." },
      { status: 500 }
    );
  }
}
