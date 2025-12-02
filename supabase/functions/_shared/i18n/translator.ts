/**
 * Translator
 * Simple translation function with fallback support
 */

import type { Language } from "../config/constants.ts";
import { DEFAULT_LANGUAGE } from "../config/constants.ts";
import { en } from "./locales/en.ts";
import { fr } from "./locales/fr.ts";
import { rw } from "./locales/rw.ts";

// ============================================================================
// TYPES
// ============================================================================

export type TranslationKey = string;
export type TranslationParams = Record<string, string | number>;
export type Translations = Record<string, string>;

// ============================================================================
// LOCALE MAP
// ============================================================================

const locales: Record<Language, Translations> = {
  en,
  fr,
  rw,
  sw: en, // Fallback to English for Swahili (not yet implemented)
};

// ============================================================================
// TRANSLATION FUNCTION
// ============================================================================

/**
 * Translate a key to the given language
 */
export function t(
  locale: Language,
  key: TranslationKey,
  params?: TranslationParams
): string {
  // Get translation from locale or fallback to default
  const translations = locales[locale] || locales[DEFAULT_LANGUAGE];
  let message = translations[key] || locales[DEFAULT_LANGUAGE][key] || key;

  // Replace parameters if provided
  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      message = message.replace(`{${param}}`, String(value));
    });
  }

  return message;
}

/**
 * Get all translations for a locale
 */
export function getTranslations(locale: Language): Translations {
  return locales[locale] || locales[DEFAULT_LANGUAGE];
}

/**
 * Check if a translation key exists
 */
export function hasTranslation(locale: Language, key: TranslationKey): boolean {
  const translations = locales[locale] || locales[DEFAULT_LANGUAGE];
  return key in translations;
}
