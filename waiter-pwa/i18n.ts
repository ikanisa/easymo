/**
 * @deprecated This file has been split into separate files for better organization.
 * Please use:
 * - waiter-pwa/i18n/config.ts for locale configuration
 * - waiter-pwa/i18n/request.ts for next-intl request configuration
 * 
 * This file is kept for backwards compatibility during the migration period.
 * It will be removed in a future release.
 */

// Re-export from the new location
export { locales, defaultLocale, localeNames } from './i18n/config';
export type { Locale } from './i18n/config';

// For next-intl configuration, import from i18n/request.ts
import requestConfig from './i18n/request';
export default requestConfig;
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
};

export default getRequestConfig(async ({ locale }): Promise<{ locale: string; messages: any }> => {
  // Validate that the incoming `locale` parameter is valid
  if (!locale || !locales.includes(locale as Locale)) notFound();

  return {
    locale: locale as string,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
