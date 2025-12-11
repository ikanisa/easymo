/**
 * Google Text-to-Speech Integration for Call Center AGI
 * 
 * Better quality than OpenAI TTS for:
 * - Phone-optimized encoding (MULAW/PCM16)
 * - Multiple voice personas
 * - African language support
 */

import { logStructuredEvent } from '../_shared/observability.ts';

// Voice presets for different languages and use cases
export const VOICE_PRESETS = {
  // Kinyarwanda (Female - Standard)
  'rw-RW-Standard-A': {
    languageCode: 'rw-RW',
    name: 'rw-RW-Standard-A',
    ssmlGender: 'FEMALE',
  },
  // English (Female - Conversational)
  'en-US-Neural2-F': {
    languageCode: 'en-US',
    name: 'en-US-Neural2-F',
    ssmlGender: 'FEMALE',
  },
  // French (Female - Standard)
  'fr-FR-Neural2-A': {
    languageCode: 'fr-FR',
    name: 'fr-FR-Neural2-A',
    ssmlGender: 'FEMALE',
  },
  // Swahili (Female - Standard)
  'sw-KE-Standard-A': {
    languageCode: 'sw-KE',
    name: 'sw-KE-Standard-A',
    ssmlGender: 'FEMALE',
  },
} as const;

export type VoicePreset = keyof typeof VOICE_PRESETS;

export interface GoogleTTSResult {
  audioContent: ArrayBuffer;
  audioFormat: 'OGG_OPUS' | 'MP3' | 'LINEAR16' | 'MULAW';
  languageCode: string;
  voiceName: string;
}

/**
 * Synthesize speech using Google Cloud Text-to-Speech
 */
export async function synthesizeSpeech(
  text: string,
  options: {
    languageCode?: string;
    voiceName?: VoicePreset;
    audioFormat?: 'OGG_OPUS' | 'MP3' | 'LINEAR16' | 'MULAW';
    speakingRate?: number;
    pitch?: number;
  } = {}
): Promise<GoogleTTSResult> {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    await logStructuredEvent('google_tts.started', {
      correlationId,
      textLength: text.length,
      languageCode: options.languageCode,
      voiceName: options.voiceName,
    });

    const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_CLOUD_API_KEY not configured');
    }

    // Auto-select voice based on language
    const languageCode = options.languageCode || 'rw-RW';
    const voiceName = options.voiceName || selectVoiceForLanguage(languageCode);
    const audioFormat = options.audioFormat || 'OGG_OPUS';

    const voice = VOICE_PRESETS[voiceName];

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: voice.languageCode,
            name: voice.name,
            ssmlGender: voice.ssmlGender,
          },
          audioConfig: {
            audioEncoding: audioFormat,
            speakingRate: options.speakingRate || 1.0,
            pitch: options.pitch || 0.0,
            effectsProfileId: ['telephony-class-application'], // Optimize for phone
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google TTS failed: ${error}`);
    }

    const data = await response.json();

    if (!data.audioContent) {
      throw new Error('No audio content in TTS response');
    }

    // Decode base64 audio
    const audioContent = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0)).buffer;
    const duration = Date.now() - startTime;

    await logStructuredEvent('google_tts.success', {
      correlationId,
      audioSize: audioContent.byteLength,
      voiceName: voice.name,
      duration,
    });

    return {
      audioContent,
      audioFormat,
      languageCode: voice.languageCode,
      voiceName: voice.name,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logStructuredEvent('google_tts.error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });

    throw error;
  }
}

/**
 * Select appropriate voice based on language code
 */
function selectVoiceForLanguage(languageCode: string): VoicePreset {
  const lang = languageCode.split('-')[0].toLowerCase();
  
  const voiceMap: Record<string, VoicePreset> = {
    'rw': 'rw-RW-Standard-A',
    'en': 'en-US-Neural2-F',
    'fr': 'fr-FR-Neural2-A',
    'sw': 'sw-KE-Standard-A',
  };

  return voiceMap[lang] || 'en-US-Neural2-F';
}

/**
 * Synthesize speech with SSML for advanced control
 */
export async function synthesizeSpeechSSML(
  ssml: string,
  options: {
    languageCode?: string;
    voiceName?: VoicePreset;
    audioFormat?: 'OGG_OPUS' | 'MP3' | 'LINEAR16' | 'MULAW';
  } = {}
): Promise<GoogleTTSResult> {
  const correlationId = crypto.randomUUID();
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY not configured');
  }

  const languageCode = options.languageCode || 'rw-RW';
  const voiceName = options.voiceName || selectVoiceForLanguage(languageCode);
  const audioFormat = options.audioFormat || 'OGG_OPUS';
  const voice = VOICE_PRESETS[voiceName];

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { ssml },
        voice: {
          languageCode: voice.languageCode,
          name: voice.name,
          ssmlGender: voice.ssmlGender,
        },
        audioConfig: {
          audioEncoding: audioFormat,
          effectsProfileId: ['telephony-class-application'],
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google TTS (SSML) failed: ${error}`);
  }

  const data = await response.json();
  const audioContent = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0)).buffer;

  return {
    audioContent,
    audioFormat,
    languageCode: voice.languageCode,
    voiceName: voice.name,
  };
}
