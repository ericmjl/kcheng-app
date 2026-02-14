import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUid } from "@/lib/workos-auth";
import { getOpenAIKey } from "@/lib/llm-keys";
import OpenAI from "openai";
import { z } from "zod";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Shape of contact data extracted from a business card image.
 * Kept in sync with the Convex contacts table fields used in api.contacts.create
 * (name, company, role, phone, email, stockTicker, notes, pronouns).
 */
const ScannedContactSchema = z
  .object({
    name: z.string().optional().default(""),
    company: z.string().optional().default(""),
    role: z.string().optional().default(""),
    phone: z.string().optional().default(""),
    email: z.string().optional().default(""),
    notes: z.string().optional().default(""),
    stockTicker: z.string().optional().default(""),
    pronouns: z.string().optional().default(""),
  })
  .strict();

/** Title-case a string (e.g. "ALEXIS FERGUSON" → "Alexis Ferguson"). */
function toTitleCase(s: string): string {
  if (!s.trim()) return s;
  return s
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function trimContact(
  raw: z.infer<typeof ScannedContactSchema>
): z.infer<typeof ScannedContactSchema> {
  return {
    name: raw.name?.trim() ?? "",
    company: raw.company?.trim() ?? "",
    role: raw.role?.trim() ?? "",
    phone: raw.phone?.trim() ?? "",
    email: raw.email?.trim() ?? "",
    notes: raw.notes?.trim() ?? "",
    stockTicker: raw.stockTicker?.trim() ?? "",
    pronouns: raw.pronouns?.trim() ?? "",
  };
}

/** Normalize case of display-oriented fields so all-caps from OCR looks professional. */
function normalizeCase(
  c: z.infer<typeof ScannedContactSchema>
): z.infer<typeof ScannedContactSchema> {
  return {
    name: toTitleCase(c.name ?? ""),
    company: toTitleCase(c.company ?? ""),
    role: toTitleCase(c.role ?? ""),
    phone: c.phone ?? "",
    email: (c.email ?? "").toLowerCase(),
    notes: toTitleCase(c.notes ?? ""),
    stockTicker: (c.stockTicker ?? "").toUpperCase(),
    pronouns: c.pronouns ?? "",
  };
}

/**
 * JSON Schema for OpenAI Structured Outputs; matches ScannedContactSchema.
 * Hand-maintained for strict-mode compatibility (zod-to-json-schema has Zod 4 def differences).
 */
const SCANNED_CONTACT_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" },
    company: { type: "string" },
    role: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    notes: { type: "string" },
    stockTicker: { type: "string" },
    pronouns: { type: "string" },
  },
  required: [
    "name",
    "company",
    "role",
    "phone",
    "email",
    "notes",
    "stockTicker",
    "pronouns",
  ],
  additionalProperties: false,
};

const SCAN_SYSTEM_PROMPT = `You are given a photo of a business card. Extract contact information into the exact JSON shape required. Use empty string for any field not found. Normalize phone (digits only if helpful) and keep email as-is.`;

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
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scanned_contact",
          strict: true,
          schema: SCANNED_CONTACT_JSON_SCHEMA,
        },
      },
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

    const result = ScannedContactSchema.safeParse(parsed);
    if (!result.success) {
      return NextResponse.json(
        { error: "Extracted data did not match schema" },
        { status: 500 }
      );
    }

    const contact = normalizeCase(trimContact(result.data));
    return NextResponse.json({ contact });
  } catch (e) {
    console.error("[scan-card]", e);
    return NextResponse.json(
      { error: "Scan failed. Try another image or check your API key." },
      { status: 500 }
    );
  }
}
