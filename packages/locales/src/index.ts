/**
 * @easymo/locales - Internationalization (i18n) translations for EasyMO platform
 * 
 * Supported locales:
 * - en: English
 * - fr: French
 * - rw: Kinyarwanda
 * 
 * This package will be populated during the Ibimina merger.
 * See: docs/MERGER_PLAN.md for details.
 */

export type SupportedLocale = 'en' | 'fr' | 'rw';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'fr', 'rw'];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export interface TranslationNamespace {
  common: Record<string, string>;
  vendor: Record<string, string>;
  admin: Record<string, string>;
  errors: Record<string, string>;
}

export type Translations = Record<SupportedLocale, TranslationNamespace>;

/**
 * Get the translation for a given key and locale
 * Placeholder - will be implemented during Ibimina merger
 */
export function t(key: string, locale: SupportedLocale = DEFAULT_LOCALE): string {
  // Placeholder implementation - returns key
  // Full implementation will come from Ibimina merger
  return key;
}

/**
 * Get all translations for a locale
 * Placeholder - will be implemented during Ibimina merger
 */
export function getTranslations(_locale: SupportedLocale): Partial<TranslationNamespace> {
  // Placeholder implementation
  // Full translations will come from Ibimina merger
  return {
    common: {},
    vendor: {},
    admin: {},
    errors: {},
  };
}
