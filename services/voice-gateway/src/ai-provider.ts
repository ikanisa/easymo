/**
 * Unified AI Provider Service
 * 
 * Provides a single interface to switch between OpenAI and Google
 * for Speech-to-Text, Text-to-Speech, and Translation services.
 * 
 * Provider selection is configurable via environment variables or per-call.
 */

import {
  createSpeechClient,
  createTTSClient,
  type LanguageCode,
  type SpeechClient,
  type SynthesizeConfig,
  type SynthesizeResult,
  synthesizeSpeech,
  TELEPHONY_LANGUAGES,
  type TextToSpeechClient,
  transcribeAudio,
  type TranscribeConfig,
  type TranscriptResult,
  Translator,
  VOICE_PRESETS,
} from '@easymo/google-speech';

import { config } from './config';
import { logger } from './logger';

export type AIProvider = 'openai' | 'google';

export interface ProviderConfig {
  /** Primary STT provider (default: from env VOICE_STT_PROVIDER) */
  sttProvider?: AIProvider;
  /** Primary TTS provider (default: from env VOICE_TTS_PROVIDER) */
  ttsProvider?: AIProvider;
  /** Primary translation provider (default: from env VOICE_TRANSLATE_PROVIDER) */
  translateProvider?: AIProvider;
  /** Enable fallback to secondary provider on failure */
  enableFallback?: boolean;
}

/**
 * Unified AI Provider Service
 * 
 * Manages Speech-to-Text, Text-to-Speech, and Translation
 * across Google and OpenAI providers with configurable selection.
 */
export class UnifiedAIProvider {
  private googleSpeechClient: SpeechClient | null = null;
  private googleTTSClient: TextToSpeechClient | null = null;
  private googleTranslator: Translator | null = null;

  private config: ProviderConfig;

  constructor(providerConfig: ProviderConfig = {}) {
    this.config = {
      sttProvider: providerConfig.sttProvider || (config.VOICE_STT_PROVIDER as AIProvider) || 'openai',
      ttsProvider: providerConfig.ttsProvider || (config.VOICE_TTS_PROVIDER as AIProvider) || 'openai',
      translateProvider: providerConfig.translateProvider || (config.VOICE_TRANSLATE_PROVIDER as AIProvider) || 'google',
      enableFallback: providerConfig.enableFallback ?? true,
    };

    // Initialize Google clients if needed
    this.initializeGoogleClients();
  }

  /**
   * Initialize Google Cloud clients lazily
   */
  private initializeGoogleClients(): void {
    // Only initialize if Google is the selected provider or fallback is enabled
    const needsGoogle = 
      this.config.sttProvider === 'google' ||
      this.config.ttsProvider === 'google' ||
      this.config.translateProvider === 'google' ||
      this.config.enableFallback;

    if (needsGoogle && config.GOOGLE_CLOUD_PROJECT) {
      try {
        this.googleSpeechClient = createSpeechClient();
        this.googleTTSClient = createTTSClient();
        this.googleTranslator = new Translator(config.GOOGLE_CLOUD_PROJECT);
        logger.info({ msg: 'ai_provider.google_clients_initialized' });
      } catch (error) {
        logger.warn({ error, msg: 'ai_provider.google_init_failed' });
      }
    }
  }

  /**
   * Transcribe audio to text
   * 
   * Uses the configured STT provider (OpenAI Whisper or Google Speech-to-Text)
   * Falls back to secondary provider if primary fails and fallback is enabled.
   * 
   * @param audioBuffer - Raw audio data (PCM16, µ-law, or OGG Opus)
   * @param language - BCP-47 language code (e.g., 'rw-RW', 'en-US')
   * @param overrideProvider - Force a specific provider for this call
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    language: string = 'en-US',
    overrideProvider?: AIProvider
  ): Promise<TranscriptResult> {
    const provider = overrideProvider || this.config.sttProvider;

    try {
      if (provider === 'google') {
        return await this.transcribeWithGoogle(audioBuffer, language);
      } else {
        return await this.transcribeWithOpenAI(audioBuffer, language);
      }
    } catch (error) {
      logger.error({ provider, error, msg: 'ai_provider.stt_primary_failed' });

      // Try fallback if enabled
      if (this.config.enableFallback && !overrideProvider) {
        const fallbackProvider: AIProvider = provider === 'google' ? 'openai' : 'google';
        logger.info({ fallbackProvider, msg: 'ai_provider.stt_fallback' });
        
        try {
          if (fallbackProvider === 'google') {
            return await this.transcribeWithGoogle(audioBuffer, language);
          } else {
            return await this.transcribeWithOpenAI(audioBuffer, language);
          }
        } catch (fallbackError) {
          logger.error({ fallbackProvider, error: fallbackError, msg: 'ai_provider.stt_fallback_failed' });
        }
      }

      // Return empty result on failure
      return { transcript: '', confidence: 0, isFinal: true };
    }
  }

  /**
   * Synthesize speech from text
   * 
   * Uses the configured TTS provider (OpenAI or Google Text-to-Speech)
   * Falls back to secondary provider if primary fails and fallback is enabled.
   * 
   * @param text - Text to synthesize
   * @param language - BCP-47 language code
   * @param voiceStyle - Voice style/name (provider-specific)
   * @param overrideProvider - Force a specific provider for this call
   */
  async synthesizeSpeech(
    text: string,
    language: string = 'en-US',
    voiceStyle?: string,
    overrideProvider?: AIProvider
  ): Promise<SynthesizeResult> {
    const provider = overrideProvider || this.config.ttsProvider;

    try {
      if (provider === 'google') {
        return await this.synthesizeWithGoogle(text, language, voiceStyle);
      } else {
        return await this.synthesizeWithOpenAI(text, language, voiceStyle);
      }
    } catch (error) {
      logger.error({ provider, error, msg: 'ai_provider.tts_primary_failed' });

      // Try fallback if enabled
      if (this.config.enableFallback && !overrideProvider) {
        const fallbackProvider: AIProvider = provider === 'google' ? 'openai' : 'google';
        logger.info({ fallbackProvider, msg: 'ai_provider.tts_fallback' });
        
        try {
          if (fallbackProvider === 'google') {
            return await this.synthesizeWithGoogle(text, language, voiceStyle);
          } else {
            return await this.synthesizeWithOpenAI(text, language, voiceStyle);
          }
        } catch (fallbackError) {
          logger.error({ fallbackProvider, error: fallbackError, msg: 'ai_provider.tts_fallback_failed' });
        }
      }

      throw error;
    }
  }

  /**
   * Translate text between languages
   * 
   * Uses Google Translate API (primary) as it has better Kinyarwanda support.
   * 
   * @param text - Text to translate
   * @param targetLanguage - Target language code (e.g., 'en', 'rw', 'fr')
   * @param sourceLanguage - Source language code (optional, auto-detected if not provided)
   */
  async translateText(
    text: string,
    targetLanguage: LanguageCode,
    _sourceLanguage?: LanguageCode
  ): Promise<string> {
    if (!this.googleTranslator) {
      logger.warn({ msg: 'ai_provider.translator_not_initialized' });
      return text;
    }

    try {
      const result = await this.googleTranslator.translate(text, targetLanguage);
      return result.translatedText;
    } catch (error) {
      logger.error({ error, msg: 'ai_provider.translate_failed' });
      return text;
    }
  }

  /**
   * Translate text to English (convenience method)
   */
  async toEnglish(text: string): Promise<string> {
    if (!this.googleTranslator) {
      return text;
    }
    try {
      return await this.googleTranslator.toEnglish(text);
    } catch (error) {
      logger.error({ error, msg: 'ai_provider.to_english_failed' });
      return text;
    }
  }

  /**
   * Translate text to Kinyarwanda (convenience method)
   */
  async toKinyarwanda(text: string): Promise<string> {
    if (!this.googleTranslator) {
      return text;
    }
    try {
      return await this.googleTranslator.toKinyarwanda(text);
    } catch (error) {
      logger.error({ error, msg: 'ai_provider.to_kinyarwanda_failed' });
      return text;
    }
  }

  /**
   * Detect the language of text
   */
  async detectLanguage(text: string): Promise<LanguageCode | null> {
    if (!this.googleTranslator) {
      return null;
    }
    try {
      return await this.googleTranslator.detect(text);
    } catch (error) {
      logger.error({ error, msg: 'ai_provider.detect_language_failed' });
      return null;
    }
  }

  /**
   * Get current provider configuration
   */
  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  // ============================================================================
  // PRIVATE: Provider-specific implementations
  // ============================================================================

  /**
   * Transcribe using Google Speech-to-Text
   */
  private async transcribeWithGoogle(
    audioBuffer: Buffer,
    language: string
  ): Promise<TranscriptResult> {
    if (!this.googleSpeechClient) {
      throw new Error('Google Speech client not initialized');
    }

    const transcribeConfig: TranscribeConfig = {
      languageCode: language,
      alternativeLanguageCodes: this.getAlternativeLanguages(language),
      sampleRateHertz: config.AUDIO_SAMPLE_RATE,
      encoding: config.AUDIO_ENCODING === 'MULAW' ? 'MULAW' : 'LINEAR16',
      model: 'phone_call',
      useEnhanced: true,
      enableAutomaticPunctuation: true,
    };

    logger.info({ language, msg: 'ai_provider.google_stt_start' });
    const result = await transcribeAudio(this.googleSpeechClient, audioBuffer, transcribeConfig);
    logger.info({ confidence: result.confidence, msg: 'ai_provider.google_stt_done' });

    return result;
  }

  /**
   * Transcribe using OpenAI Whisper
   * 
   * Note: In realtime mode, Whisper is handled by the OpenAI Realtime API.
   * This method is for batch transcription of recorded audio.
   */
  private async transcribeWithOpenAI(
    audioBuffer: Buffer,
    language: string
  ): Promise<TranscriptResult> {
    // For OpenAI Whisper batch API
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');
    formData.append('model', 'whisper-1');
    if (language !== 'auto') {
      formData.append('language', language.split('-')[0]); // Whisper uses ISO 639-1 codes
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OpenAI Whisper error: ${response.statusText}`);
    }

    const data = await response.json() as { text?: string };
    logger.info({ msg: 'ai_provider.openai_stt_done' });

    return {
      transcript: data.text || '',
      confidence: 1.0, // Whisper doesn't return confidence
      isFinal: true,
      languageCode: language,
    };
  }

  /**
   * Synthesize using Google Text-to-Speech
   */
  private async synthesizeWithGoogle(
    text: string,
    language: string,
    voiceStyle?: string
  ): Promise<SynthesizeResult> {
    if (!this.googleTTSClient) {
      throw new Error('Google TTS client not initialized');
    }

    const synthesizeConfig: SynthesizeConfig = {
      languageCode: language,
      voiceName: voiceStyle || this.getDefaultGoogleVoice(language),
      sampleRateHertz: config.AUDIO_SAMPLE_RATE,
      audioEncoding: config.AUDIO_ENCODING === 'MULAW' ? 'MULAW' : 'LINEAR16',
    };

    logger.info({ language, voice: synthesizeConfig.voiceName, msg: 'ai_provider.google_tts_start' });
    const result = await synthesizeSpeech(this.googleTTSClient, text, synthesizeConfig);
    logger.info({ durationMs: result.durationMs, msg: 'ai_provider.google_tts_done' });

    return result;
  }

  /**
   * Synthesize using OpenAI TTS
   * 
   * Note: OpenAI TTS outputs MP3/OGG, not PCM. Conversion may be needed.
   */
  private async synthesizeWithOpenAI(
    text: string,
    language: string,
    voiceStyle?: string
  ): Promise<SynthesizeResult> {
    const voice = voiceStyle || 'alloy';

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'pcm', // Request raw PCM
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS error: ${response.statusText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    logger.info({ voice, msg: 'ai_provider.openai_tts_done' });

    return {
      audioContent: audioBuffer,
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 24000, // OpenAI TTS uses 24kHz
    };
  }

  /**
   * Get alternative language codes for multi-language detection
   */
  private getAlternativeLanguages(primaryLanguage: string): string[] {
    // Common languages in Rwanda region
    const alternatives = [
      TELEPHONY_LANGUAGES.KINYARWANDA,
      TELEPHONY_LANGUAGES.ENGLISH_US,
      TELEPHONY_LANGUAGES.FRENCH,
      TELEPHONY_LANGUAGES.SWAHILI_KENYA,
    ];

    // Remove primary language from alternatives
    return alternatives.filter(lang => lang !== primaryLanguage);
  }

  /**
   * Get default Google voice for language
   */
  private getDefaultGoogleVoice(language: string): string | undefined {
    const voiceMap: Record<string, string | undefined> = {
      'en-US': VOICE_PRESETS.FRIENDLY_FEMALE_EN.voiceName,
      'fr-FR': VOICE_PRESETS.BUSINESS_FEMALE_FR.voiceName,
      'rw-RW': undefined, // Use default for Kinyarwanda
      'sw-KE': undefined, // Use default for Swahili
    };
    return voiceMap[language];
  }
}

// Export singleton instance for convenience
export const unifiedAIProvider = new UnifiedAIProvider();
