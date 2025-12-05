/**
 * Google Cloud Text-to-Speech Helper
 * 
 * Generates natural-sounding speech for telephony.
 * Supports multiple voices and languages.
 */

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { google } from '@google-cloud/text-to-speech/build/protos/protos';

export interface SynthesizeConfig {
  /** Language code (e.g., 'rw-RW', 'en-US', 'fr-FR') */
  languageCode: string;
  /** Voice name (optional, uses default for language if not specified) */
  voiceName?: string;
  /** Voice gender */
  ssmlGender?: 'MALE' | 'FEMALE' | 'NEUTRAL';
  /** Speaking rate (0.25 to 4.0, default 1.0) */
  speakingRate?: number;
  /** Pitch adjustment (-20.0 to 20.0 semitones, default 0.0) */
  pitch?: number;
  /** Volume gain in dB (-96.0 to 16.0, default 0.0) */
  volumeGainDb?: number;
  /** Audio encoding for output */
  audioEncoding?: 'LINEAR16' | 'MP3' | 'OGG_OPUS' | 'MULAW' | 'ALAW';
  /** Sample rate for output (default: 8000 for telephony) */
  sampleRateHertz?: number;
}

export interface SynthesizeResult {
  audioContent: Buffer;
  audioEncoding: string;
  sampleRateHertz: number;
  durationMs?: number;
}

const DEFAULT_CONFIG: SynthesizeConfig = {
  languageCode: 'en-US',
  ssmlGender: 'FEMALE',
  speakingRate: 1.0,
  pitch: 0.0,
  volumeGainDb: 0.0,
  audioEncoding: 'MULAW',
  sampleRateHertz: 8000,
};

/**
 * Voice presets for different domains/personas
 */
export const VOICE_PRESETS = {
  // Professional voices for business contexts
  BUSINESS_FEMALE_EN: { languageCode: 'en-US', voiceName: 'en-US-Neural2-C', ssmlGender: 'FEMALE' as const },
  BUSINESS_MALE_EN: { languageCode: 'en-US', voiceName: 'en-US-Neural2-D', ssmlGender: 'MALE' as const },
  
  // Friendly voices for customer service
  FRIENDLY_FEMALE_EN: { languageCode: 'en-US', voiceName: 'en-US-Neural2-F', ssmlGender: 'FEMALE' as const },
  FRIENDLY_MALE_EN: { languageCode: 'en-US', voiceName: 'en-US-Neural2-J', ssmlGender: 'MALE' as const },
  
  // French voices
  BUSINESS_FEMALE_FR: { languageCode: 'fr-FR', voiceName: 'fr-FR-Neural2-A', ssmlGender: 'FEMALE' as const },
  BUSINESS_MALE_FR: { languageCode: 'fr-FR', voiceName: 'fr-FR-Neural2-B', ssmlGender: 'MALE' as const },
  
  // Swahili voices
  SWAHILI_FEMALE: { languageCode: 'sw-KE', ssmlGender: 'FEMALE' as const },
  SWAHILI_MALE: { languageCode: 'sw-KE', ssmlGender: 'MALE' as const },
} as const;

/**
 * Create a Text-to-Speech client
 */
export function createTTSClient(): TextToSpeechClient {
  return new TextToSpeechClient();
}

/**
 * Synthesize speech from text
 */
export async function synthesizeSpeech(
  client: TextToSpeechClient,
  text: string,
  config: Partial<SynthesizeConfig> = {}
): Promise<SynthesizeResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const request = {
    input: { text },
    voice: {
      languageCode: mergedConfig.languageCode,
      name: mergedConfig.voiceName,
      ssmlGender: mergedConfig.ssmlGender as unknown as google.cloud.texttospeech.v1.SsmlVoiceGender,
    },
    audioConfig: {
      audioEncoding: mergedConfig.audioEncoding as unknown as google.cloud.texttospeech.v1.AudioEncoding,
      speakingRate: mergedConfig.speakingRate,
      pitch: mergedConfig.pitch,
      volumeGainDb: mergedConfig.volumeGainDb,
      sampleRateHertz: mergedConfig.sampleRateHertz,
    },
  };

  const [response] = await client.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error('No audio content in TTS response');
  }

  const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

  // Estimate duration based on audio size and encoding
  let durationMs: number | undefined;
  if (mergedConfig.audioEncoding === 'MULAW' || mergedConfig.audioEncoding === 'ALAW') {
    // 8-bit samples, 8000 Hz = 8000 bytes per second
    durationMs = (audioBuffer.length / (mergedConfig.sampleRateHertz || 8000)) * 1000;
  } else if (mergedConfig.audioEncoding === 'LINEAR16') {
    // 16-bit samples = 2 bytes per sample
    durationMs = (audioBuffer.length / 2 / (mergedConfig.sampleRateHertz || 8000)) * 1000;
  }

  return {
    audioContent: audioBuffer,
    audioEncoding: mergedConfig.audioEncoding || 'MULAW',
    sampleRateHertz: mergedConfig.sampleRateHertz || 8000,
    durationMs,
  };
}

/**
 * Synthesize speech from SSML (for advanced control)
 */
export async function synthesizeSSML(
  client: TextToSpeechClient,
  ssml: string,
  config: Partial<SynthesizeConfig> = {}
): Promise<SynthesizeResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const request = {
    input: { ssml },
    voice: {
      languageCode: mergedConfig.languageCode,
      name: mergedConfig.voiceName,
      ssmlGender: mergedConfig.ssmlGender as unknown as google.cloud.texttospeech.v1.SsmlVoiceGender,
    },
    audioConfig: {
      audioEncoding: mergedConfig.audioEncoding as unknown as google.cloud.texttospeech.v1.AudioEncoding,
      speakingRate: mergedConfig.speakingRate,
      pitch: mergedConfig.pitch,
      volumeGainDb: mergedConfig.volumeGainDb,
      sampleRateHertz: mergedConfig.sampleRateHertz,
    },
  };

  const [response] = await client.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error('No audio content in TTS response');
  }

  return {
    audioContent: Buffer.from(response.audioContent as Uint8Array),
    audioEncoding: mergedConfig.audioEncoding || 'MULAW',
    sampleRateHertz: mergedConfig.sampleRateHertz || 8000,
  };
}

/**
 * Build SSML with common patterns
 */
export const SSMLBuilder = {
  /**
   * Wrap text with a pause
   */
  withPause(text: string, pauseMs: number = 500): string {
    return `<speak>${text}<break time="${pauseMs}ms"/></speak>`;
  },

  /**
   * Emphasize text
   */
  emphasize(text: string, level: 'strong' | 'moderate' | 'reduced' = 'moderate'): string {
    return `<speak><emphasis level="${level}">${text}</emphasis></speak>`;
  },

  /**
   * Say as a specific type (phone number, date, etc.)
   */
  sayAs(text: string, interpretAs: 'characters' | 'cardinal' | 'ordinal' | 'fraction' | 'unit' | 'date' | 'time' | 'telephone' | 'address'): string {
    return `<speak><say-as interpret-as="${interpretAs}">${text}</say-as></speak>`;
  },

  /**
   * Adjust speaking rate for a section
   */
  withRate(text: string, rate: 'x-slow' | 'slow' | 'medium' | 'fast' | 'x-fast' = 'medium'): string {
    return `<speak><prosody rate="${rate}">${text}</prosody></speak>`;
  },

  /**
   * Combine multiple SSML fragments
   */
  combine(...fragments: string[]): string {
    const content = fragments
      .map((f) => f.replace(/<\/?speak>/g, ''))
      .join(' ');
    return `<speak>${content}</speak>`;
  },
};
