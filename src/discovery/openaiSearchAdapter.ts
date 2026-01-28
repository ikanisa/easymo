import type { SearchResult } from "./types";

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_BASE_URL = "https://api.openai.com";

export type OpenAISearchOptions = {
  query: string;
  maxResults: number;
};

function uniqueByUrl(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  for (const result of results) {
    const url = result.url ?? "";
    if (url && seen.has(url)) continue;
    if (url) seen.add(url);
    deduped.push(result);
  }
  return deduped;
}

export async function searchWithOpenAI(options: OpenAISearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return [];
  }

  const baseUrl = process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.OPENAI_WEB_SEARCH_MODEL || DEFAULT_MODEL;

  const response = await fetch(`${baseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content: options.query }],
      tools: [{ type: "web_search" }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`openai_web_search_failed:${response.status}:${text}`);
  }

  const payload = await response.json();
  const results: SearchResult[] = [];

  for (const item of payload.output ?? []) {
    if (item?.type !== "web_search_call") continue;

    if (Array.isArray(item.results)) {
      for (const entry of item.results) {
        results.push({
          title: entry?.title,
          url: entry?.url,
          snippet: entry?.snippet,
        });
      }
    }

    const sources = item.action?.sources;
    if (Array.isArray(sources)) {
      for (const source of sources) {
        results.push({
          title: source?.title,
          url: source?.url,
          snippet: source?.snippet ?? source?.description,
        });
      }
    }
  }

  return uniqueByUrl(results).slice(0, options.maxResults);
}
