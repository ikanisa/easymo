/**
 * Google Speech-to-Text Integration for Call Center AGI
 * 
 * Better quality than OpenAI Whisper for:
 * - Telephony audio (8kHz)
 * - African languages (Kinyarwanda, Swahili)
 * - Lower latency
 */

import { logStructuredEvent } from '../_shared/observability.ts';

// Google Cloud Speech-to-Text configuration for telephony
const GOOGLE_STT_CONFIG = {
  encoding: 'OGG_OPUS', // WhatsApp audio format
  sampleRateHertz: 16000, // WhatsApp audio rate
  languageCode: 'rw-RW',
  alternativeLanguageCodes: ['en-US', 'fr-FR', 'sw-TZ'],
  enableAutomaticPunctuation: true,
  model: 'phone_call',
  useEnhanced: true,
};

export interface GoogleSTTResult {
  transcript: string;
  confidence: number;
  languageCode: string;
  provider: 'google';
}

/**
 * Transcribe audio using Google Cloud Speech-to-Text
 * Falls back to OpenAI Whisper if Google fails
 */
export async function transcribeWithGoogle(
  audioBuffer: ArrayBuffer,
  options: {
    languageCode?: string;
    fallbackToOpenAI?: boolean;
  } = {}
): Promise<GoogleSTTResult> {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  try {
    await logStructuredEvent('google_stt.started', {
      correlationId,
      audioSize: audioBuffer.byteLength,
      languageCode: options.languageCode || GOOGLE_STT_CONFIG.languageCode,
    });

    const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_CLOUD_API_KEY not configured');
    }

    // Convert audio buffer to base64
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audioBuffer))
    );

    // Call Google Cloud Speech-to-Text API
    const response = await fetch(
      'https://speech.googleapis.com/v1/speech:recognize',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          config: {
            ...GOOGLE_STT_CONFIG,
            languageCode: options.languageCode || GOOGLE_STT_CONFIG.languageCode,
          },
          audio: {
            content: base64Audio,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google STT failed: ${error}`);
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result?.alternatives?.[0]) {
      throw new Error('No transcription result from Google STT');
    }

    const alt = result.alternatives[0];
    const duration = Date.now() - startTime;

    await logStructuredEvent('google_stt.success', {
      correlationId,
      transcript: alt.transcript,
      confidence: alt.confidence,
      languageCode: result.languageCode,
      duration,
    });

    return {
      transcript: alt.transcript || '',
      confidence: alt.confidence || 0,
      languageCode: result.languageCode || GOOGLE_STT_CONFIG.languageCode,
      provider: 'google',
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logStructuredEvent('google_stt.error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });

    // Fallback to OpenAI Whisper
    if (options.fallbackToOpenAI !== false) {
      return await transcribeWithOpenAIFallback(audioBuffer);
    }

    throw error;
  }
}

/**
 * Fallback to OpenAI Whisper when Google fails
 */
async function transcribeWithOpenAIFallback(
  audioBuffer: ArrayBuffer
): Promise<GoogleSTTResult> {
  const correlationId = crypto.randomUUID();
  
  await logStructuredEvent('openai_whisper.fallback_started', {
    correlationId,
    reason: 'google_stt_failed',
  });

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured for fallback');
  }

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer]), 'audio.ogg');
  formData.append('model', 'whisper-1');
  formData.append('language', 'rw'); // Kinyarwanda

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Whisper fallback failed: ${error}`);
  }

  const data = await response.json();

  await logStructuredEvent('openai_whisper.fallback_success', {
    correlationId,
    transcript: data.text,
  });

  return {
    transcript: data.text || '',
    confidence: 0.9, // OpenAI doesn't provide confidence
    languageCode: 'rw-RW',
    provider: 'google', // Mark as google for consistency
  };
}

/**
 * Detect language from audio
 */
export async function detectLanguage(
  audioBuffer: ArrayBuffer
): Promise<string> {
  try {
    const result = await transcribeWithGoogle(audioBuffer, {
      languageCode: 'rw-RW', // Primary language
      fallbackToOpenAI: false,
    });
    return result.languageCode;
  } catch {
    return 'rw-RW'; // Default to Kinyarwanda
  }
}
