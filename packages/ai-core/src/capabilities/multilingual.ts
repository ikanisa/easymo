/**
 * Multilingual Support System
 * Supports Kinyarwanda, French, English, and Swahili
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'ai-core' });

export type SupportedLanguage = 'en' | 'fr' | 'rw' | 'sw';

export interface TranslationConfig {
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  text: string;
}

/**
 * Multilingual Manager
 */
export class MultilingualSupport {
  private supabase: SupabaseClient;
  private translations: Map<string, Map<SupportedLanguage, string>>;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.translations = new Map();
    this.loadCommonTranslations();
  }

  /**
   * Load common translations
   */
  private loadCommonTranslations() {
    // Common greetings
    this.addTranslation('greeting', {
      en: 'Hello! How can I help you today?',
      fr: 'Bonjour! Comment puis-je vous aider aujourd\'hui?',
      rw: 'Muraho! Nkwifashije nte uyu munsi?',
      sw: 'Habari! Ninaweza kukusaidia vipi leo?'
    });

    // Common responses
    this.addTranslation('thank_you', {
      en: 'Thank you!',
      fr: 'Merci!',
      rw: 'Murakoze!',
      sw: 'Asante!'
    });

    this.addTranslation('please_wait', {
      en: 'Please wait a moment...',
      fr: 'Veuillez patienter un instant...',
      rw: 'Tegereza gato...',
      sw: 'Tafadhali subiri kidogo...'
    });

    this.addTranslation('error_occurred', {
      en: 'An error occurred. Please try again.',
      fr: 'Une erreur s\'est produite. Veuillez réessayer.',
      rw: 'Habaye ikosa. Ongera ugerageze.',
      sw: 'Kuna hitilafu. Tafadhali jaribu tena.'
    });

    // Agent-specific
    this.addTranslation('jobs_agent_intro', {
      en: 'I\'m your career coach. I\'ll help you find jobs.',
      fr: 'Je suis votre conseiller de carrière. Je vous aiderai à trouver un emploi.',
      rw: 'Ndi umujyanama wawe w\'umwuga. Nzagufasha gushaka akazi.',
      sw: 'Mimi ni mshauri wako wa kazi. Nitakusaidia kupata kazi.'
    });

    this.addTranslation('waiter_agent_intro', {
      en: 'Welcome! I\'m your virtual waiter. What would you like to order?',
      fr: 'Bienvenue! Je suis votre serveur virtuel. Que souhaitez-vous commander?',
      rw: 'Murakaza neza! Ndi umuseruvisi wawe. Ushaka gutumiza iki?',
      sw: 'Karibu! Mimi ni mhudumu wako wa dijiti. Unataka kuagiza nini?'
    });
  }

  /**
   * Add translation
   */
  private addTranslation(key: string, translations: Record<SupportedLanguage, string>) {
    this.translations.set(key, new Map(Object.entries(translations) as [SupportedLanguage, string][]));
  }

  /**
   * Get translation for a key
   */
  getTranslation(key: string, language: SupportedLanguage): string {
    const translations = this.translations.get(key);
    if (!translations) {
      return key; // Return key if no translation found
    }
    return translations.get(language) || translations.get('en') || key;
  }

  /**
   * Get user's preferred language
   */
  async getUserLanguage(userId: string): Promise<SupportedLanguage> {
    const { data, error } = await this.supabase
      .from('user_preferences')
      .select('preferred_language')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return 'en'; // Default to English
    }

    return data.preferred_language as SupportedLanguage;
  }

  /**
   * Set user's preferred language
   */
  async setUserLanguage(userId: string, language: SupportedLanguage): Promise<void> {
    await this.supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preferred_language: language,
        updated_at: new Date().toISOString()
      });
  }

  /**
   * Detect language from text (simple heuristic)
   */
  detectLanguage(text: string): SupportedLanguage {
    const lowerText = text.toLowerCase();

    // Kinyarwanda indicators
    if (lowerText.includes('muraho') || lowerText.includes('murakoze') || lowerText.includes('yego')) {
      return 'rw';
    }

    // French indicators
    if (lowerText.includes('bonjour') || lowerText.includes('merci') || lowerText.includes('oui')) {
      return 'fr';
    }

    // Swahili indicators
    if (lowerText.includes('habari') || lowerText.includes('asante') || lowerText.includes('ndiyo')) {
      return 'sw';
    }

    // Default to English
    return 'en';
  }

  /**
   * Translate text using Google Translate API
   */
  async translateText(config: TranslationConfig): Promise<string> {
    // This would use Google Translate API
    // For now, check if we have a cached translation
    
    // In production, integrate with Google Cloud Translation API
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      return config.text; // Return original if no API key
    }

    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: config.text,
            source: config.sourceLanguage,
            target: config.targetLanguage,
            format: 'text'
          })
        }
      );

      const data = await response.json();
      return data.data.translations[0].translatedText;
    } catch (error) {
      log.error('Translation error:', error);
      return config.text; // Return original on error
    }
  }

  /**
   * Format agent response in user's language
   */
  async formatResponse(
    userId: string,
    responseKey: string,
    fallbackText?: string
  ): Promise<string> {
    const userLanguage = await this.getUserLanguage(userId);
    const translation = this.getTranslation(responseKey, userLanguage);
    
    if (translation === responseKey && fallbackText) {
      // If no translation found and fallback provided, translate fallback
      return await this.translateText({
        sourceLanguage: 'en',
        targetLanguage: userLanguage,
        text: fallbackText
      });
    }

    return translation;
  }
}

/**
 * Language detection and auto-translation middleware
 */
export async function detectAndTranslate(
  text: string,
  targetLanguage: SupportedLanguage,
  multilingual: MultilingualSupport
): Promise<string> {
  const detectedLanguage = multilingual.detectLanguage(text);
  
  if (detectedLanguage === targetLanguage) {
    return text; // Already in target language
  }

  return await multilingual.translateText({
    sourceLanguage: detectedLanguage,
    targetLanguage,
    text
  });
}
