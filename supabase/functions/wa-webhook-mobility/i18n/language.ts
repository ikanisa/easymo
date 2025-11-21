export type SupportedLanguage = "en" | "fr" | "es" | "pt" | "de" | "sw";

const SUPPORTED: SupportedLanguage[] = ["en", "fr", "es", "pt", "de", "sw"];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

function normalizeCandidate(value: string): string {
  return value
    .trim()
    .replace(/_/g, "-")
    .toLowerCase();
}

export function coerceToSupportedLanguage(
  candidate: unknown,
): SupportedLanguage | null {
  if (typeof candidate !== "string" || !candidate.trim()) return null;
  const normalized = normalizeCandidate(candidate);
  for (const lang of SUPPORTED) {
    if (normalized === lang) return lang;
    if (normalized.startsWith(`${lang}-`)) return lang;
  }
  return null;
}

export function resolveLanguage(
  ...candidates: Array<string | null | undefined>
): SupportedLanguage {
  for (const candidate of candidates) {
    const supported = coerceToSupportedLanguage(candidate);
    if (supported) return supported;
  }
  return DEFAULT_LANGUAGE;
}

export function langEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const normalizedA = coerceToSupportedLanguage(a);
  const normalizedB = coerceToSupportedLanguage(b);
  return normalizedA !== null && normalizedA === normalizedB;
}
