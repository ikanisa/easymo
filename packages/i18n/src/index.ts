// Unified i18n package for EasyMO
// Consolidates @easymo/locales, @easymo/localization, and @easymo/ibimina-locales

// Re-export locales
export * from './locales/index.js';

// Re-export utilities
export * from './utils/index.js';

// Re-export ibimina-specific (without types to avoid duplicate exports)
export {
  contentPacks,
  enRWContentPack,
  enRWMessages,
  frRWContentPack,
  frRWMessages,
  frSNContentPack,
  frSNMessages,
  getAvailableLocales,
  getContentPack,
  getContentPackByCountry,
  getLocalesForCountry,
  getMessageDictionary,
  getMessages,
  getSurfaceCopy,
  getSurfaceCopyVariant,
  messages,
  resolveContentPack,
  resolveMessages,
  rwRWContentPack,
  rwRWMessages,
} from './locales/ibimina/index.js';

// Re-export types explicitly to avoid conflicts
export type { CopyVariant,SurfaceCopy } from './locales/ibimina/surface-copy.js';
export type { CountryContentPack, LocaleCode, TranslationMessages } from './types/ibimina/index.js';
