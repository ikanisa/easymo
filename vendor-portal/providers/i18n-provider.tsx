"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import enCommon from "@/locales/en/common.json";
import enStaff from "@/locales/en/staff.json";
import rwCommon from "@/locales/rw/common.json";
import rwStaff from "@/locales/rw/staff.json";
import frCommon from "@/locales/fr/common.json";
import frStaff from "@/locales/fr/staff.json";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type SupportedLocale,
  isSupportedLocale,
} from "@/lib/i18n/locales";
import { BASE_DICTIONARIES, ENGLISH_DICTIONARY } from "@/lib/i18n/base-dictionary";

const APP_DICTIONARIES: Record<SupportedLocale, Record<string, string>> = {
  en: { ...enCommon, ...enStaff } as Record<string, string>,
  rw: { ...rwCommon, ...rwStaff } as Record<string, string>,
  fr: { ...frCommon, ...frStaff } as Record<string, string>,
};

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, fallback?: string, replacements?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: React.ReactNode;
  defaultLocale?: SupportedLocale;
}

function persistLocaleCookie(locale: SupportedLocale) {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(locale);
  const maxAgeSeconds = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${LOCALE_COOKIE_NAME}=${encoded}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function readStoredLocale(): SupportedLocale | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LOCALE_COOKIE_NAME);
  if (isSupportedLocale(stored)) {
    return stored;
  }

  const cookieMatch = document.cookie.match(new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`));
  if (cookieMatch?.[1]) {
    const decoded = decodeURIComponent(cookieMatch[1]);
    if (isSupportedLocale(decoded)) {
      return decoded;
    }
  }

  return null;
}

export function I18nProvider({ children, defaultLocale = DEFAULT_LOCALE }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);

  useEffect(() => {
    let cancelled = false;
    const applyLocale = (next: SupportedLocale) => {
      queueMicrotask(() => {
        if (!cancelled) {
          setLocaleState(next);
        }
      });
    };
    const stored = readStoredLocale();
    if (stored) {
      applyLocale(stored);
    } else if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_COOKIE_NAME, defaultLocale);
      persistLocaleCookie(defaultLocale);
    }
    return () => {
      cancelled = true;
    };
  }, [defaultLocale]);

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_COOKIE_NAME, next);
      persistLocaleCookie(next);
    }
  }, []);

  const dictionary = useMemo(
    () => ({
      ...BASE_DICTIONARIES[locale],
      ...APP_DICTIONARIES[locale],
    }),
    [locale]
  );

  const translate = useCallback(
    (key: string, fallback?: string, replacements?: Record<string, string | number>) => {
      let value = dictionary[key];
      if (!value && locale !== "en") {
        value = APP_DICTIONARIES.en[key] ?? ENGLISH_DICTIONARY[key];
      }
      if (!value) {
        value = fallback ?? key;
      }
      if (replacements) {
        for (const [token, raw] of Object.entries(replacements)) {
          value = value.replace(new RegExp(`{{${token}}}`, "g"), String(raw));
        }
      }
      return value;
    },
    [dictionary, locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: translate,
    }),
    [locale, setLocale, translate]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useTranslation must be used within I18nProvider");
  return context;
}
