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

// Speech-to-Text
export {
  createSpeechClient,
  transcribeAudio,
  transcribeStream,
  TELEPHONY_LANGUAGES,
  type TranscribeConfig,
  type TranscriptResult,
  type TelephonyLanguage,
} from './stt';

// Text-to-Speech
export {
  createTTSClient,
  synthesizeSpeech,
  synthesizeSSML,
  VOICE_PRESETS,
  SSMLBuilder,
  type SynthesizeConfig,
  type SynthesizeResult,
} from './tts';

// Translation
export {
  createTranslateClient,
  translateText,
  translateBatch,
  detectLanguage,
  Translator,
  LANGUAGES,
  type TranslateConfig,
  type TranslateResult,
  type LanguageCode,
} from './translate';
