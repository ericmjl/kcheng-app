/**
 * Exa API: search and deep research.
 * Set EXA_API_KEY in env. Get a key at https://dashboard.exa.ai/api-keys
 * https://docs.exa.ai/
 */

export type ExaSearchResult = {
  title: string;
  url: string;
  id?: string;
  summary?: string;
  text?: string;
};

export type ExaSearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    id?: string;
    summary?: string;
    text?: string;
  }>;
};

function getKey(): string {
  const key = process.env.EXA_API_KEY;
  if (!key?.trim()) throw new Error("EXA_API_KEY is not set");
  return key.trim();
}

/**
 * Regular search. Use for finding LinkedIn profiles (category "people").
 */
export async function exaSearch(
  query: string,
  options?: {
    numResults?: number;
    type?: "auto" | "fast" | "deep" | "neural" | "instant";
    category?: "people" | "company" | "news" | "research paper" | "tweet" | "personal site" | "financial report";
    includeDomains?: string[];
  }
): Promise<ExaSearchResult[]> {
  const key = getKey();
  const body: Record<string, unknown> = {
    query,
    numResults: Math.min(Math.max(options?.numResults ?? 10, 1), 100),
    type: options?.type ?? "auto",
  };
  if (options?.category) body.category = options.category;
  if (options?.includeDomains?.length) body.includeDomains = options.includeDomains;

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Exa search error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as ExaSearchResponse;
  const results = data.results ?? [];
  return results
    .filter((r) => r.url)
    .map((r) => ({
      title: r.title ?? "",
      url: r.url!,
      id: r.id,
      summary: r.summary,
      text: r.text,
    }));
}

export type ExaResearchTask = {
  researchId: string;
  status: string;
  output?: string | { markdown?: string; content?: string; report?: string };
  instructions?: string;
};

/** Extract markdown/text from a completed Exa research task (string or nested object). */
export function exaResearchOutputToString(task: ExaResearchTask): string {
  const out = task.output;
  if (typeof out === "string" && out.trim()) return out.trim();
  if (out && typeof out === "object") {
    const s =
      (out as { markdown?: string }).markdown ??
      (out as { content?: string }).content ??
      (out as { report?: string }).report ??
      (out as { text?: string }).text;
    if (typeof s === "string" && s.trim()) return s.trim();
    // fallback: use stringified object so we don't lose data
    try {
      const str = JSON.stringify(out);
      if (str.length > 50) return str;
    } catch {
      // ignore
    }
  }
  return "";
}

/**
 * Create a research task (async). Returns researchId; poll with exaResearchGet.
 */
export async function exaResearchCreate(
  instructions: string,
  options?: { model?: "exa-research-fast" | "exa-research" | "exa-research-pro" }
): Promise<{ researchId: string }> {
  const key = getKey();
  const res = await fetch("https://api.exa.ai/research/v1", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instructions: instructions.slice(0, 4096),
      model: options?.model ?? "exa-research",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Exa research create error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { researchId: string };
  return { researchId: data.researchId };
}

/**
 * Get research task status and output (when completed).
 */
export async function exaResearchGet(researchId: string): Promise<ExaResearchTask> {
  const key = getKey();
  const res = await fetch(`https://api.exa.ai/research/v1/${researchId}`, {
    method: "GET",
    headers: { "x-api-key": key },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Exa research get error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as ExaResearchTask;
  return data;
}

const RESEARCH_POLL_INTERVAL_MS = 4000;
const RESEARCH_MAX_WAIT_MS = 120000; // 2 minutes

/**
 * Run deep research: create task, poll until completed, return markdown output.
 */
export async function exaResearch(
  instructions: string,
  options?: {
    model?: "exa-research-fast" | "exa-research" | "exa-research-pro";
    pollIntervalMs?: number;
    maxWaitMs?: number;
  }
): Promise<string> {
  const { researchId } = await exaResearchCreate(instructions, { model: options?.model });
  const pollInterval = options?.pollIntervalMs ?? RESEARCH_POLL_INTERVAL_MS;
  const deadline = Date.now() + (options?.maxWaitMs ?? RESEARCH_MAX_WAIT_MS);

  while (Date.now() < deadline) {
    const task = await exaResearchGet(researchId);
    const statusLower = String(task.status ?? "").toLowerCase();
    if (statusLower === "completed") {
      return exaResearchOutputToString(task);
    }
    if (statusLower === "failed" || statusLower === "canceled") {
      throw new Error(`Exa research ${task.status}`);
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }
  throw new Error("Exa research timed out");
}
