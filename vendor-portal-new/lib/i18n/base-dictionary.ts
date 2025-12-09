import { getMessageDictionary, type LocaleCode } from "@ibimina/locales";

import { SUPPORTED_LOCALES, type SupportedLocale } from "./locales";

const FALLBACK_LOCALE_CODE: LocaleCode = "en-RW";

const LOCALE_CODE_BY_APP_LOCALE: Record<SupportedLocale, LocaleCode> = {
  en: "en-RW",
  rw: "rw-RW",
  fr: "fr-SN",
};

function resolveLocaleCode(locale: SupportedLocale): LocaleCode {
  return LOCALE_CODE_BY_APP_LOCALE[locale] ?? FALLBACK_LOCALE_CODE;
}

function createBaseDictionary(locale: SupportedLocale): Record<string, string> {
  const localeCode = resolveLocaleCode(locale);
  const merged = getMessageDictionary(localeCode, { fallbackLocale: FALLBACK_LOCALE_CODE });
  const fallback = getMessageDictionary(FALLBACK_LOCALE_CODE, {
    fallbackLocale: FALLBACK_LOCALE_CODE,
  });

  return { ...fallback, ...merged };
}

export const BASE_DICTIONARIES: Record<
  SupportedLocale,
  Record<string, string>
> = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [locale, createBaseDictionary(locale)])
) as Record<SupportedLocale, Record<string, string>>;

export const ENGLISH_DICTIONARY = BASE_DICTIONARIES.en;
