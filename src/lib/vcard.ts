import * as vcardParser from "vcard-parser";
import type { Contact } from "./types";

type VCardParsed = Record<string, Array<{ value: string | string[] }>>;

function firstValue(v: string | string[]): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && v.length) return String(v[0]).trim();
  return "";
}

export function vCardToContact(raw: string): Partial<Contact> {
  const parsed = vcardParser.parse(raw) as VCardParsed;
  const name =
    firstValue(parsed.fn?.[0]?.value ?? "") ||
    [parsed.n?.[0]?.value].flat().filter(Boolean).map(firstValue).join(" ").trim() ||
    "";
  const tel = parsed.tel?.[0]?.value;
  const email = parsed.email?.[0]?.value;
  const org = parsed.org?.[0]?.value;
  const title = parsed.title?.[0]?.value;
  const note = parsed.note?.[0]?.value;
  return {
    name: name || "Unknown",
    phone: tel ? firstValue(tel) : undefined,
    email: email ? firstValue(email) : undefined,
    company: org ? firstValue(org) : undefined,
    role: title ? firstValue(title) : undefined,
    notes: note ? firstValue(note) : undefined,
    eventIds: [],
  };
}
