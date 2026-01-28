import type { SearchResult } from "./types";

const DEFAULT_MODEL = "gemini-2.0-flash-exp";

export type GeminiSearchOptions = {
  query: string;
  maxResults: number;
};

export async function searchWithGemini(options: GeminiSearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return [];
  }

  const model = process.env.GEMINI_SEARCH_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: options.query }] }],
      tools: [{ googleSearch: {} }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`gemini_search_failed:${response.status}:${text}`);
  }

  const payload = await response.json();
  const candidate = payload?.candidates?.[0];
  const grounding = candidate?.groundingMetadata;
  const chunks = grounding?.groundingChunks ?? [];

  const results: SearchResult[] = [];
  for (const chunk of chunks) {
    const web = chunk?.web;
    if (!web?.uri && !web?.title) continue;
    results.push({
      title: web?.title,
      url: web?.uri,
      snippet: web?.snippet,
    });
  }

  return results.slice(0, options.maxResults);
}
