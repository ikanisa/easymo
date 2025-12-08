/**
 * Translator
 * Simple translation function with fallback support
 * 
 * CRITICAL: Kinyarwanda (rw) is BLOCKED from UI translation
 */

import type { Language } from "../config/constants.ts";
import { DEFAULT_LANGUAGE, BLOCKED_UI_LANGUAGES } from "../config/constants.ts";
import { en } from "./locales/en.ts";
import { fr } from "./locales/fr.ts";

// ============================================================================
// TYPES
// ============================================================================

export type TranslationKey = string;
export type TranslationParams = Record<string, string | number>;
export type Translations = Record<string, string>;

// ============================================================================
// LOCALE MAP
// ============================================================================
// NOTE: 'rw' (Kinyarwanda) is intentionally EXCLUDED from UI translations

const locales: Record<Language, Translations> = {
  en,
  fr,
  sw: en, // Fallback to English for Swahili (not yet implemented)
  es: en, // Fallback to English for Spanish (not yet implemented)
  pt: en, // Fallback to English for Portuguese (not yet implemented)
  de: en, // Fallback to English for German (not yet implemented)
};

// ============================================================================
// TRANSLATION FUNCTION
// ============================================================================

/**
 * Translate a key to the given language
 * CRITICAL: Blocks Kinyarwanda (rw) translations
 */
export function t(
  locale: Language,
  key: TranslationKey,
  params?: TranslationParams
): string {
  // CRITICAL: Block Kinyarwanda - force to default language
  const normalizedLocale = locale.toLowerCase();
  if (BLOCKED_UI_LANGUAGES.some(blocked => normalizedLocale === blocked || normalizedLocale.startsWith(blocked + '-'))) {
    console.warn(`[i18n] Blocked UI translation to Kinyarwanda (${locale}). Using ${DEFAULT_LANGUAGE} instead.`);
    locale = DEFAULT_LANGUAGE;
  }

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
