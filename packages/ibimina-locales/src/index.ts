/**
 * @ibimina/locales - Multi-country localization
 *
 * Content packs and translations for different countries and languages
 */

// Export types
export type { LocaleCode, CountryContentPack, TranslationMessages } from "./types/index";
export type { SurfaceCopy, CopyVariant } from "./surface-copy";

// Export locale content packs
export { rwRWContentPack, rwRWMessages } from "./locales/rw-RW";
export { enRWContentPack, enRWMessages } from "./locales/en-RW";
export { frSNContentPack, frSNMessages } from "./locales/fr-SN";
export { frRWContentPack, frRWMessages } from "./locales/fr-RW";
export { getSurfaceCopy, getSurfaceCopyVariant } from "./surface-copy";

// Locale registry
import type { LocaleCode, CountryContentPack, TranslationMessages } from "./types/index";
import { rwRWContentPack, rwRWMessages } from "./locales/rw-RW";
import { enRWContentPack, enRWMessages } from "./locales/en-RW";
import { frSNContentPack, frSNMessages } from "./locales/fr-SN";
import { frRWContentPack, frRWMessages } from "./locales/fr-RW";

const DEFAULT_FALLBACK_LOCALE: LocaleCode = "en-RW";

/**
 * Registry of all available content packs
 */
export const contentPacks: Record<string, CountryContentPack> = {
  "rw-RW": rwRWContentPack,
  "en-RW": enRWContentPack,
  "fr-RW": frRWContentPack,
  "fr-SN": frSNContentPack,
};

/**
 * Registry of all available translations
 */
export const messages: Record<string, TranslationMessages> = {
  "rw-RW": rwRWMessages,
  "en-RW": enRWMessages,
  "fr-RW": frRWMessages,
  "fr-SN": frSNMessages,
};

/**
 * Get content pack for a locale
 */
export function getContentPack(locale: LocaleCode): CountryContentPack | undefined {
  return contentPacks[locale];
}

/**
 * Get messages for a locale
 */
export function getMessages(locale: LocaleCode): TranslationMessages | undefined {
  return messages[locale];
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }

  if (value && typeof value === "object") {
    const clone: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      clone[key] = deepClone(entry);
    }
    return clone as T;
  }

  return value;
}

function mergeDeep<T>(base: T, override?: Partial<T>): T {
  const target = deepClone(base);
  if (!override) return target;

  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined) continue;
    const baseValue = (target as Record<string, unknown>)[key];

    if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
      (target as Record<string, unknown>)[key] = deepClone(overrideValue);
      continue;
    }

    if (
      baseValue &&
      overrideValue &&
      typeof baseValue === "object" &&
      typeof overrideValue === "object" &&
      !Array.isArray(baseValue) &&
      !Array.isArray(overrideValue)
    ) {
      (target as Record<string, unknown>)[key] = mergeDeep(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      );
      continue;
    }

    (target as Record<string, unknown>)[key] = deepClone(overrideValue);
  }

  return target;
}

/**
 * Resolve messages for a locale with fallback merging.
 */
export function resolveMessages(
  locale: LocaleCode,
  options?: { fallbackLocale?: LocaleCode }
): TranslationMessages {
  const fallbackLocale = options?.fallbackLocale ?? DEFAULT_FALLBACK_LOCALE;
  const fallbackMessages = messages[fallbackLocale];

  if (!fallbackMessages) {
    throw new Error(`Fallback locale ${fallbackLocale} has no translation messages`);
  }

  const localeMessages = messages[locale];

  if (!localeMessages) {
    return mergeDeep(fallbackMessages, undefined);
  }

  return mergeDeep(fallbackMessages, localeMessages);
}

/**
 * Resolve a content pack with fallback merging.
 */
export function resolveContentPack(
  locale: LocaleCode,
  options?: { fallbackLocale?: LocaleCode }
): CountryContentPack {
  const fallbackLocale = options?.fallbackLocale ?? DEFAULT_FALLBACK_LOCALE;
  const fallbackPack = contentPacks[fallbackLocale];

  if (!fallbackPack) {
    throw new Error(`Fallback locale ${fallbackLocale} has no content pack`);
  }

  const localePack = contentPacks[locale];

  if (!localePack) {
    return mergeDeep(fallbackPack, undefined);
  }

  return mergeDeep(fallbackPack, localePack);
}

function flattenObject(value: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, entry] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      Object.assign(result, flattenObject(entry as Record<string, unknown>, nextKey));
    } else if (entry !== undefined && entry !== null) {
      result[nextKey] = String(entry);
    }
  }

  return result;
}

/**
 * Get a flattened dictionary of translation messages for quick lookup.
 */
export function getMessageDictionary(
  locale: LocaleCode,
  options?: { fallbackLocale?: LocaleCode }
): Record<string, string> {
  const resolved = resolveMessages(locale, options);
  return flattenObject(resolved as unknown as Record<string, unknown>);
}

/**
 * Get content pack by country ISO3 code (returns first match)
 */
export function getContentPackByCountry(countryISO3: string): CountryContentPack | undefined {
  return Object.values(contentPacks).find(
    (pack) => pack.countryISO3.toUpperCase() === countryISO3.toUpperCase()
  );
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): LocaleCode[] {
  return Object.keys(contentPacks) as LocaleCode[];
}

/**
 * Get locales for a specific country
 */
export function getLocalesForCountry(countryISO3: string): LocaleCode[] {
  return Object.entries(contentPacks)
    .filter(([_, pack]) => pack.countryISO3.toUpperCase() === countryISO3.toUpperCase())
    .map(([locale, _]) => locale as LocaleCode);
}
