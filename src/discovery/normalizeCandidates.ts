import type { CandidateVendor, SearchResult } from "./types";

const PHONE_REGEX = /(?:\+?\d[\d\s().-]{6,}\d)/g;

function extractPhones(text?: string): string[] {
  if (!text) return [];
  const matches = text.match(PHONE_REGEX) ?? [];
  return matches
    .map((raw) => raw.replace(/[\s().-]/g, ""))
    .filter((value) => value.length >= 8)
    .slice(0, 3);
}

function normalizeName(result: SearchResult): string {
  if (result.title && result.title.trim().length > 0) return result.title.trim();
  if (result.url && result.url.trim().length > 0) return result.url.replace(/^https?:\/\//, "");
  return "Unknown vendor";
}

function baseConfidence(result: SearchResult, phones: string[]): number {
  if (phones.length > 0) return 0.55;
  if (result.url) return 0.35;
  return 0.2;
}

export function normalizeSearchResults(results: SearchResult[]): CandidateVendor[] {
  const seen = new Set<string>();
  const candidates: CandidateVendor[] = [];

  for (const result of results) {
    const key = result.url ?? result.title ?? "";
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);

    const phones = extractPhones(result.snippet);
    const candidate: CandidateVendor = {
      name: normalizeName(result),
      phones,
      website: result.url,
      confidence: baseConfidence(result, phones),
      sources: [result],
    };

    candidates.push(candidate);
  }

  return candidates;
}
