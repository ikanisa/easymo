/**
 * i18n Configuration
 * Supported locales and default settings
 */

export const locales = ['en', 'fr', 'rw'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  rw: 'Kinyarwanda',
};

/**
 * Get locale from user's device or profile settings
 */
export function getPreferredLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  
  // Check localStorage for user preference
  const stored = localStorage.getItem('preferred_locale') as Locale | null;
  if (stored && locales.includes(stored)) {
    return stored;
  }
  
  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (locales.includes(browserLang as Locale)) {
    return browserLang as Locale;
  }
  
  return defaultLocale;
}

/**
 * Set user's preferred locale
 */
export function setPreferredLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('preferred_locale', locale);
  }
}
