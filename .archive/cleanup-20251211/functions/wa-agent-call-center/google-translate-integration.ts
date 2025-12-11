/**
 * Google Translate Integration for Call Center AGI
 * 
 * Supports multi-language conversations:
 * - Auto-detect user language
 * - Translate AGI responses to user's language
 * - Kinyarwanda, English, French, Swahili
 */

import { logStructuredEvent } from '../_shared/observability.ts';

const SUPPORTED_LANGUAGES = {
  'rw': 'Kinyarwanda',
  'en': 'English',
  'fr': 'French',
  'sw': 'Swahili',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
}

/**
 * Detect language of text
 */
export async function detectTextLanguage(text: string): Promise<string> {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!apiKey) {
    return 'en'; // Default to English
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }),
      }
    );

    if (!response.ok) {
      return 'en';
    }

    const data = await response.json();
    const detection = data.data?.detections?.[0]?.[0];
    
    return detection?.language || 'en';
  } catch {
    return 'en';
  }
}

/**
 * Translate text using Google Translate
 */
export async function translateText(
  text: string,
  targetLang: SupportedLanguage,
  sourceLang?: SupportedLanguage
): Promise<TranslationResult> {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    await logStructuredEvent('google_translate.started', {
      correlationId,
      textLength: text.length,
      targetLang,
      sourceLang,
    });

    const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_CLOUD_API_KEY not configured');
    }

    const params: any = {
      q: text,
      target: targetLang,
      format: 'text',
    };

    if (sourceLang) {
      params.source = sourceLang;
    }

    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Translate failed: ${error}`);
    }

    const data = await response.json();
    const translation = data.data?.translations?.[0];

    if (!translation) {
      throw new Error('No translation result');
    }

    const duration = Date.now() - startTime;

    await logStructuredEvent('google_translate.success', {
      correlationId,
      translatedTextLength: translation.translatedText.length,
      detectedSourceLanguage: translation.detectedSourceLanguage,
      duration,
    });

    return {
      translatedText: translation.translatedText,
      detectedSourceLanguage: translation.detectedSourceLanguage || sourceLang || 'unknown',
      targetLanguage: targetLang,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logStructuredEvent('google_translate.error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });

    // Return original text if translation fails
    return {
      translatedText: text,
      detectedSourceLanguage: sourceLang || 'unknown',
      targetLanguage: targetLang,
    };
  }
}

/**
 * Auto-translate to user's preferred language
 */
export async function autoTranslate(
  text: string,
  userLanguage: string
): Promise<string> {
  // Normalize language code (e.g., 'rw-RW' -> 'rw')
  const targetLang = userLanguage.split('-')[0].toLowerCase() as SupportedLanguage;

  if (!Object.keys(SUPPORTED_LANGUAGES).includes(targetLang)) {
    return text; // Return as-is if language not supported
  }

  // Detect source language
  const sourceLang = await detectTextLanguage(text);
  
  // If already in target language, return as-is
  if (sourceLang === targetLang) {
    return text;
  }

  const result = await translateText(text, targetLang, sourceLang as SupportedLanguage);
  return result.translatedText;
}

/**
 * Translate batch of messages
 */
export async function translateBatch(
  texts: string[],
  targetLang: SupportedLanguage
): Promise<string[]> {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!apiKey) {
    return texts; // Return originals if no API key
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: texts,
          target: targetLang,
          format: 'text',
        }),
      }
    );

    if (!response.ok) {
      return texts;
    }

    const data = await response.json();
    return data.data?.translations?.map((t: any) => t.translatedText) || texts;
  } catch {
    return texts;
  }
}
