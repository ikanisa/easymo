// Unified i18n package for EasyMO
// Consolidates @easymo/locales, @easymo/localization, and @easymo/ibimina-locales

// Re-export locales
export * from './locales/index.js';

// Re-export utilities
export * from './utils/index.js';

// Re-export ibimina-specific (without types to avoid duplicate exports)
export {
  rwRWContentPack,
  rwRWMessages,
  enRWContentPack,
  enRWMessages,
  frSNContentPack,
  frSNMessages,
  frRWContentPack,
  frRWMessages,
  getSurfaceCopy,
  getSurfaceCopyVariant,
  contentPacks,
  messages,
  getContentPack,
  getMessages,
  resolveMessages,
  resolveContentPack,
  getMessageDictionary,
  getContentPackByCountry,
  getAvailableLocales,
  getLocalesForCountry,
} from './locales/ibimina/index.js';

// Re-export types explicitly to avoid conflicts
export type { LocaleCode, CountryContentPack, TranslationMessages } from './types/ibimina/index.js';
export type { SurfaceCopy, CopyVariant } from './locales/ibimina/surface-copy.js';
