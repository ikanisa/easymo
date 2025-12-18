import { DEFAULT_LANGUAGE, type SupportedLanguage } from "./language.ts";
import EN from "./messages/en.json" with { type: "json" };

type Params = Record<string, string | number>;
type Catalog = Record<string, unknown>;

// Rwanda-only, English-only system
const CATALOGS: Record<SupportedLanguage, Catalog> = {
  en: EN as Catalog,
  fr: EN as Catalog,  // Fallback to English
  es: EN as Catalog,  // Fallback to English
  pt: EN as Catalog,  // Fallback to English
  de: EN as Catalog,  // Fallback to English
  sw: EN as Catalog,  // Fallback to English
};

export type TranslationKey = string;

export function t(
  locale: SupportedLanguage,
  key: TranslationKey,
  params: Params = {},
): string {
  const catalog = CATALOGS[locale] ?? CATALOGS[DEFAULT_LANGUAGE];
  const fallback = CATALOGS[DEFAULT_LANGUAGE];
  const phrase = resolvePhrase(catalog, key) ?? resolvePhrase(fallback, key) ??
    key;
  return applyParams(phrase, params);
}

function resolvePhrase(catalog: Catalog, key: string): string | null {
  const raw = catalog[key];
  return typeof raw === "string" ? raw : null;
}

function applyParams(phrase: string, params: Params): string {
  return phrase.replace(/{{\s*(\w+)\s*}}/g, (_match, token) => {
    const value = params[token];
    return value === undefined ? "" : String(value);
  });
}
