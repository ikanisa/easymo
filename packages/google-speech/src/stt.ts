/**
 * Google Cloud Speech-to-Text Helper
 * 
 * Provides streaming transcription for telephony audio.
 * Optimized for phone-grade audio (8kHz, mono, µ-law/PCM).
 */

import speech from '@google-cloud/speech';

export interface TranscribeConfig {
  /** Language code (e.g., 'rw-RW', 'en-US', 'fr-FR', 'sw-TZ') */
  languageCode: string;
  /** Alternative languages for automatic detection */
  alternativeLanguageCodes?: string[];
  /** Sample rate in Hz (default: 8000 for telephony) */
  sampleRateHertz?: number;
  /** Audio encoding (default: MULAW for telephony) */
  encoding?: 'LINEAR16' | 'MULAW' | 'AMR' | 'AMR_WB' | 'OGG_OPUS' | 'WEBM_OPUS';
  /** Enable automatic punctuation */
  enableAutomaticPunctuation?: boolean;
  /** Enable word timestamps */
  enableWordTimeOffsets?: boolean;
  /** Model to use (default: phone_call) */
  model?: 'phone_call' | 'latest_long' | 'latest_short' | 'default';
  /** Enable enhanced models (better accuracy, higher cost) */
  useEnhanced?: boolean;
}

export interface TranscriptResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  words?: Array<{
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
  languageCode?: string;
}

const DEFAULT_CONFIG: TranscribeConfig = {
  languageCode: 'rw-RW',
  alternativeLanguageCodes: ['en-US', 'fr-FR', 'sw-TZ'],
  sampleRateHertz: 8000,
  encoding: 'MULAW',
  enableAutomaticPunctuation: true,
  enableWordTimeOffsets: false,
  model: 'phone_call',
  useEnhanced: true,
};

/**
 * Create a Speech-to-Text client
 */
export function createSpeechClient(): speech.SpeechClient {
  return new speech.SpeechClient();
}

/**
 * Transcribe audio synchronously (for short audio < 1 minute)
 */
export async function transcribeAudio(
  client: speech.SpeechClient,
  audioContent: Buffer,
  config: Partial<TranscribeConfig> = {}
): Promise<TranscriptResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const request = {
    audio: {
      content: audioContent.toString('base64'),
    },
    config: {
      encoding: mergedConfig.encoding as any,
      sampleRateHertz: mergedConfig.sampleRateHertz,
      languageCode: mergedConfig.languageCode,
      alternativeLanguageCodes: mergedConfig.alternativeLanguageCodes,
      enableAutomaticPunctuation: mergedConfig.enableAutomaticPunctuation,
      enableWordTimeOffsets: mergedConfig.enableWordTimeOffsets,
      model: mergedConfig.model,
      useEnhanced: mergedConfig.useEnhanced,
    },
  };

  const [response] = await client.recognize(request);
  const result = response.results?.[0];

  if (!result?.alternatives?.[0]) {
    return { transcript: '', confidence: 0, isFinal: true };
  }

  const alt = result.alternatives[0];
  return {
    transcript: alt.transcript || '',
    confidence: alt.confidence || 0,
    isFinal: true,
    languageCode: result.languageCode || mergedConfig.languageCode,
    words: alt.words?.map((w) => ({
      word: w.word || '',
      startTime: Number(w.startTime?.seconds || 0) + Number(w.startTime?.nanos || 0) / 1e9,
      endTime: Number(w.endTime?.seconds || 0) + Number(w.endTime?.nanos || 0) / 1e9,
      confidence: w.confidence || 0,
    })),
  };
}

/**
 * Create a streaming transcription session
 * Returns an async generator that yields transcript results
 */
export async function* transcribeStream(
  client: speech.SpeechClient,
  audioStream: AsyncIterable<Buffer>,
  config: Partial<TranscribeConfig> = {}
): AsyncGenerator<TranscriptResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const request = {
    config: {
      encoding: mergedConfig.encoding as any,
      sampleRateHertz: mergedConfig.sampleRateHertz,
      languageCode: mergedConfig.languageCode,
      alternativeLanguageCodes: mergedConfig.alternativeLanguageCodes,
      enableAutomaticPunctuation: mergedConfig.enableAutomaticPunctuation,
      enableWordTimeOffsets: mergedConfig.enableWordTimeOffsets,
      model: mergedConfig.model,
      useEnhanced: mergedConfig.useEnhanced,
    },
    interimResults: true,
  };

  const recognizeStream = client.streamingRecognize(request);

  // Set up result handling
  const results: TranscriptResult[] = [];
  let resolveNext: ((value: TranscriptResult | null) => void) | null = null;
  let streamEnded = false;

  recognizeStream.on('data', (data: any) => {
    if (data.results?.[0]) {
      const result = data.results[0];
      const alt = result.alternatives?.[0];
      if (alt) {
        const transcriptResult: TranscriptResult = {
          transcript: alt.transcript || '',
          confidence: alt.confidence || 0,
          isFinal: result.isFinal || false,
          languageCode: result.languageCode,
        };
        if (resolveNext) {
          const resolve = resolveNext;
          resolveNext = null;
          resolve(transcriptResult);
        } else {
          results.push(transcriptResult);
        }
      }
    }
  });

  recognizeStream.on('error', (error: Error) => {
    console.error('STT streaming error:', error);
    if (resolveNext) {
      resolveNext(null);
    }
  });

  recognizeStream.on('end', () => {
    streamEnded = true;
    if (resolveNext) {
      resolveNext(null);
    }
  });

  // Send audio chunks
  (async () => {
    for await (const chunk of audioStream) {
      recognizeStream.write({ audioContent: chunk });
    }
    recognizeStream.end();
  })();

  // Yield results
  while (!streamEnded || results.length > 0) {
    if (results.length > 0) {
      yield results.shift()!;
    } else if (!streamEnded) {
      const result = await new Promise<TranscriptResult | null>((resolve) => {
        resolveNext = resolve;
      });
      if (result) {
        yield result;
      }
    }
  }
}

/**
 * Language codes supported for telephony
 */
export const TELEPHONY_LANGUAGES = {
  KINYARWANDA: 'rw-RW',
  ENGLISH_US: 'en-US',
  ENGLISH_UK: 'en-GB',
  FRENCH: 'fr-FR',
  SWAHILI_KENYA: 'sw-KE',
  SWAHILI_TANZANIA: 'sw-TZ',
} as const;

export type TelephonyLanguage = typeof TELEPHONY_LANGUAGES[keyof typeof TELEPHONY_LANGUAGES];
