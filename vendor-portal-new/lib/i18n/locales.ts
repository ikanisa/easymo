export const SUPPORTED_LOCALES = ["en", "rw", "fr"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const LOCALE_COOKIE_NAME = "ibimina_locale";

const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && SUPPORTED_LOCALE_SET.has(value);
}

export function normaliseLocaleTag(value: string): SupportedLocale | null {
  const lower = value.toLowerCase();
  if (isSupportedLocale(lower)) return lower;

  const base = lower.split("-")[0];
  if (isSupportedLocale(base)) return base;

  return null;
}
