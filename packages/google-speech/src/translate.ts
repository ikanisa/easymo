/**
 * Google Cloud Translation Helper
 * 
 * Translates text between languages for multilingual support.
 * Optimized for Kinyarwanda, English, French, and Swahili.
 */

import { TranslationServiceClient } from '@google-cloud/translate';

export interface TranslateConfig {
  /** Google Cloud project ID */
  projectId?: string;
  /** Location (default: global) */
  location?: string;
}

export interface TranslateResult {
  translatedText: string;
  detectedSourceLanguage?: string;
  model?: string;
}

/**
 * Language codes for easyMO supported languages
 */
export const LANGUAGES = {
  KINYARWANDA: 'rw',
  ENGLISH: 'en',
  FRENCH: 'fr',
  SWAHILI: 'sw',
} as const;

export type LanguageCode = typeof LANGUAGES[keyof typeof LANGUAGES];

/**
 * Create a Translation client
 */
export function createTranslateClient(): TranslationServiceClient {
  return new TranslationServiceClient();
}

/**
 * Translate text between languages
 */
export async function translateText(
  client: TranslationServiceClient,
  text: string,
  targetLanguage: LanguageCode,
  sourceLanguage?: LanguageCode,
  config?: TranslateConfig
): Promise<TranslateResult> {
  const projectId = config?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
  const location = config?.location || 'global';

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable or projectId config required');
  }

  const parent = `projects/${projectId}/locations/${location}`;

  const request = {
    parent,
    contents: [text],
    mimeType: 'text/plain',
    targetLanguageCode: targetLanguage,
    sourceLanguageCode: sourceLanguage,
  };

  const [response] = await client.translateText(request);

  if (!response.translations?.[0]) {
    throw new Error('No translation in response');
  }

  const translation = response.translations[0];

  return {
    translatedText: translation.translatedText || '',
    detectedSourceLanguage: translation.detectedLanguageCode || undefined,
    model: translation.model || undefined,
  };
}

/**
 * Translate multiple texts at once (batch)
 */
export async function translateBatch(
  client: TranslationServiceClient,
  texts: string[],
  targetLanguage: LanguageCode,
  sourceLanguage?: LanguageCode,
  config?: TranslateConfig
): Promise<TranslateResult[]> {
  const projectId = config?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
  const location = config?.location || 'global';

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable or projectId config required');
  }

  const parent = `projects/${projectId}/locations/${location}`;

  const request = {
    parent,
    contents: texts,
    mimeType: 'text/plain',
    targetLanguageCode: targetLanguage,
    sourceLanguageCode: sourceLanguage,
  };

  const [response] = await client.translateText(request);

  if (!response.translations) {
    return [];
  }

  return response.translations.map((translation) => ({
    translatedText: translation.translatedText || '',
    detectedSourceLanguage: translation.detectedLanguageCode || undefined,
    model: translation.model || undefined,
  }));
}

/**
 * Detect the language of text
 */
export async function detectLanguage(
  client: TranslationServiceClient,
  text: string,
  config?: TranslateConfig
): Promise<{ languageCode: string; confidence: number }[]> {
  const projectId = config?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
  const location = config?.location || 'global';

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable or projectId config required');
  }

  const parent = `projects/${projectId}/locations/${location}`;

  const request = {
    parent,
    content: text,
    mimeType: 'text/plain',
  };

  const [response] = await client.detectLanguage(request);

  if (!response.languages) {
    return [];
  }

  return response.languages.map((lang) => ({
    languageCode: lang.languageCode || '',
    confidence: lang.confidence || 0,
  }));
}

/**
 * Simple translation helper for common use cases
 */
export class Translator {
  private client: TranslationServiceClient;
  private projectId: string;
  private location: string;

  constructor(projectId?: string, location: string = 'global') {
    this.client = createTranslateClient();
    this.projectId = projectId || process.env.GOOGLE_CLOUD_PROJECT || '';
    this.location = location;
  }

  /**
   * Translate to English
   */
  async toEnglish(text: string): Promise<string> {
    const result = await translateText(
      this.client,
      text,
      LANGUAGES.ENGLISH,
      undefined,
      { projectId: this.projectId, location: this.location }
    );
    return result.translatedText;
  }

  /**
   * Translate to Kinyarwanda
   */
  async toKinyarwanda(text: string): Promise<string> {
    const result = await translateText(
      this.client,
      text,
      LANGUAGES.KINYARWANDA,
      undefined,
      { projectId: this.projectId, location: this.location }
    );
    return result.translatedText;
  }

  /**
   * Translate to French
   */
  async toFrench(text: string): Promise<string> {
    const result = await translateText(
      this.client,
      text,
      LANGUAGES.FRENCH,
      undefined,
      { projectId: this.projectId, location: this.location }
    );
    return result.translatedText;
  }

  /**
   * Translate to Swahili
   */
  async toSwahili(text: string): Promise<string> {
    const result = await translateText(
      this.client,
      text,
      LANGUAGES.SWAHILI,
      undefined,
      { projectId: this.projectId, location: this.location }
    );
    return result.translatedText;
  }

  /**
   * Translate with auto-detect source
   */
  async translate(text: string, target: LanguageCode): Promise<TranslateResult> {
    return translateText(
      this.client,
      text,
      target,
      undefined,
      { projectId: this.projectId, location: this.location }
    );
  }

  /**
   * Detect language
   */
  async detect(text: string): Promise<LanguageCode | null> {
    const results = await detectLanguage(
      this.client,
      text,
      { projectId: this.projectId, location: this.location }
    );
    if (results.length > 0 && results[0].confidence > 0.5) {
      return results[0].languageCode as LanguageCode;
    }
    return null;
  }
}
