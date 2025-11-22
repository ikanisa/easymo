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
export type { Locale } from './i18n/config';
export { defaultLocale, localeNames,locales } from './i18n/config';

// For next-intl configuration, import from i18n/request.ts
import requestConfig from './i18n/request';
export default requestConfig;
