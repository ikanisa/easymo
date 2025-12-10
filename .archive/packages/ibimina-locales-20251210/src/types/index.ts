/**
 * Locale Types
 * Type definitions for multi-country localization
 */

/**
 * Supported locale codes
 */
export type LocaleCode =
  | "rw-RW" // Kinyarwanda (Rwanda)
  | "en-RW" // English (Rwanda)
  | "fr-RW" // French (Rwanda)
  | "fr-SN" // French (Senegal)
  | "fr-CI" // French (Côte d'Ivoire)
  | "en-GH" // English (Ghana)
  | "en-ZM" // English (Zambia)
  | "en-MW" // English (Malawi)
  | "en-TZ" // English (Tanzania)
  | "fr-BI" // French (Burundi)
  | "fr-CD"; // French (DR Congo)

/**
 * Country-specific content pack
 */
export interface CountryContentPack {
  locale: LocaleCode;
  countryISO3: string;
  countryName: string;

  // USSD guidance
  ussd: {
    providers: Array<{
      name: string;
      code: string;
      instructions: string[];
      telco?: string;
      variants?: Array<{
        telco: string;
        code: string;
        instructions: string[];
        notes?: string[];
      }>;
    }>;
    generalInstructions: string[];
    fallbackMessage?: string;
  };

  // Legal pages
  legal: {
    termsUrl: string;
    privacyUrl: string;
    cookiesUrl?: string;
  };

  // Help content
  help: {
    paymentGuide: string[];
    troubleshooting: string[];
    contactInfo: {
      helpline?: string;
      email?: string;
      hours?: string;
    };
  };

  // Market-specific tips
  tips?: {
    dualSim?: string[];
    networkIssues?: string[];
    marketDays?: string[];
    contactless?: string[];
  };
}

/**
 * Translation messages for UI
 */
export interface TranslationMessages {
  common: {
    welcome: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    loading: string;
    error: string;
    success: string;
  };

  payment: {
    title: string;
    amount: string;
    reference: string;
    confirmPayment: string;
    paymentSuccess: string;
    paymentFailed: string;
  };

  member: {
    title: string;
    name: string;
    phone: string;
    memberCode: string;
    joinDate: string;
  };

  group: {
    title: string;
    groupName: string;
    groupCode: string;
    members: string;
    totalSavings: string;
  };

  accessibility: {
    motionToggleLabel: string;
    talkbackHint: string;
    voiceoverHint: string;
  };

  offers: {
    title: string;
    description: string;
    cta: string;
    upcoming: string;
  };
}
