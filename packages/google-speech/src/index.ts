/**
 * @easymo/google-speech
 * 
 * Google Cloud Speech-to-Text, Text-to-Speech, and Translation helpers.
 * Optimized for telephony audio and multilingual support.
 * 
 * @example
 * ```typescript
 * import { 
 *   createSpeechClient, transcribeAudio, 
 *   createTTSClient, synthesizeSpeech,
 *   Translator 
 * } from '@easymo/google-speech';
 * 
 * // Speech-to-Text
 * const sttClient = createSpeechClient();
 * const result = await transcribeAudio(sttClient, audioBuffer, {
 *   languageCode: 'rw-RW',
 *   model: 'phone_call'
 * });
 * 
 * // Text-to-Speech
 * const ttsClient = createTTSClient();
 * const audio = await synthesizeSpeech(ttsClient, 'Hello!', {
 *   languageCode: 'en-US',
 *   audioEncoding: 'MULAW'
 * });
 * 
 * // Translation
 * const translator = new Translator();
 * const english = await translator.toEnglish('Muraho!');
 * ```
 */

// Re-export Speech client type
export type { SpeechClient } from '@google-cloud/speech';

// Re-export TTS client type
export type { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Speech-to-Text
export {
  createSpeechClient,
  TELEPHONY_LANGUAGES,
  type TelephonyLanguage,
  transcribeAudio,
  type TranscribeConfig,
  transcribeStream,
  type TranscriptResult,
} from './stt';

// Text-to-Speech
export {
  createTTSClient,
  SSMLBuilder,
  type SynthesizeConfig,
  type SynthesizeResult,
  synthesizeSpeech,
  synthesizeSSML,
  VOICE_PRESETS,
} from './tts';

// Translation
export {
  createTranslateClient,
  detectLanguage,
  type LanguageCode,
  LANGUAGES,
  translateBatch,
  type TranslateConfig,
  type TranslateResult,
  translateText,
  Translator,
} from './translate';
