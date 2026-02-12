/**
 * Parse Excel (.xlsx, .xls) and Word (.docx) uploads into structured text
 * for the assistant to turn into contacts, events, and todos.
 */

const EXCEL_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
];
const WORD_MIMES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc - mammoth may still work for some
];

export function isParseableDoc(mediaType: string): boolean {
  const t = mediaType.toLowerCase().split(";")[0].trim();
  return EXCEL_MIMES.includes(t) || WORD_MIMES.includes(t);
}

export function isExcel(mediaType: string): boolean {
  const t = mediaType.toLowerCase().split(";")[0].trim();
  return EXCEL_MIMES.includes(t);
}

export function isWord(mediaType: string): boolean {
  const t = mediaType.toLowerCase().split(";")[0].trim();
  return WORD_MIMES.includes(t);
}

/**
 * Extract base64 payload from a data URL (e.g. from FileUIPart.url).
 */
function base64FromDataUrl(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

function toBuffer(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

/**
 * Parse an Excel file (buffer) into a string description of sheets and rows
 * suitable for the model to map to contacts, events, todos.
 */
async function parseExcelBuffer(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    if (rows.length === 0) continue;
    lines.push(`Sheet: "${sheetName}"`);
    lines.push(JSON.stringify(rows, null, 0));
    lines.push("");
  }
  return lines.join("\n").trim() || "(empty spreadsheet)";
}

/**
 * Parse a Word document (buffer) into plain text.
 */
async function parseWordBuffer(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim() || "(empty document)";
}

export type ParsedDoc = { kind: "excel" | "word"; text: string };

/**
 * Parse an uploaded file from a data URL (FileUIPart.url).
 * Returns null if the media type is not Excel or Word.
 */
export async function parseDocumentFromDataUrl(
  dataUrl: string,
  mediaType: string
): Promise<ParsedDoc | null> {
  if (!isParseableDoc(mediaType)) return null;
  const base64 = base64FromDataUrl(dataUrl);
  const buffer = toBuffer(base64);
  if (isExcel(mediaType)) {
    const text = await parseExcelBuffer(buffer);
    return { kind: "excel", text };
  }
  if (isWord(mediaType)) {
    const text = await parseWordBuffer(buffer);
    return { kind: "word", text };
  }
  return null;
}
