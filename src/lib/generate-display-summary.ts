import OpenAI from "openai";
import { getOpenAIKey } from "@/lib/llm-keys";

type ContactForSummary = {
  name: string;
  company?: string;
  role?: string;
  notes?: string;
  linkedInUrl?: string;
  researchSummary?: string;
};

const PROMPT = (c: ContactForSummary) => `You are writing a short, professional profile summary for a contact card. Use only the information provided. Use they/them or the person's name unless specific pronouns are known.

Contact information:
- Name: ${c.name}
${c.company ? `- Company: ${c.company}` : ""}
${c.role ? `- Role: ${c.role}` : ""}
${c.notes ? `- Notes: ${c.notes}` : ""}
${c.linkedInUrl ? `- LinkedIn: ${c.linkedInUrl}` : ""}
${c.researchSummary ? `\nBackground research on this person:\n${c.researchSummary.slice(0, 8000)}` : ""}

Write a concise summary in 2–4 sentences suitable for a contact card. Use markdown (e.g. **bold** for name/role, one short paragraph). No heading. Output only the summary.`;

/**
 * Generate an AI display summary for a contact. Returns null if no OpenAI key or on error.
 */
export async function generateDisplaySummary(
  uid: string | null,
  contact: ContactForSummary
): Promise<string | null> {
  const key = await getOpenAIKey(uid);
  if (!key?.trim()) return null;
  if (!contact.name?.trim()) return null;
  try {
    const openai = new OpenAI({ apiKey: key });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 512,
      messages: [{ role: "user", content: PROMPT(contact) }],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}
