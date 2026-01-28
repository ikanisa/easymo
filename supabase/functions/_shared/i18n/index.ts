/**
 * I18n Module Exports
 */

export type { TranslationKey, TranslationParams, Translations } from "./translator.ts";
export { getTranslations, hasTranslation,t } from "./translator.ts";

// Export locales
export { en } from "./locales/en.ts";
export { fr } from "./locales/fr.ts";
export { rw } from "./locales/rw.ts";
