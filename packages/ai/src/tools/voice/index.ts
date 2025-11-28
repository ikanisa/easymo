/**
 * Voice Tools - Speech-to-Text and Text-to-Speech
 *
 * Provides Whisper (OpenAI) for transcription and TTS capabilities.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'voice-tools' });

// ============================================================================
// TYPES
// ============================================================================

/**
 * Whisper transcription result
 */
export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * TTS result
 */
export interface TTSResult {
  audio: Buffer;
  format: string;
  duration?: number;
}

/**
 * Voice type for TTS
 */
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// ============================================================================
// SCHEMAS
// ============================================================================

export const WhisperInputSchema = z.object({
  audio: z.string().describe('Base64 encoded audio data'),
  language: z.string().optional().describe('Language code (e.g., "en", "rw", "fr")'),
  prompt: z.string().optional().describe('Optional prompt to guide transcription'),
  responseFormat: z.enum(['json', 'text', 'srt', 'verbose_json', 'vtt']).optional(),
});

export const TTSInputSchema = z.object({
  text: z.string().describe('Text to convert to speech'),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional(),
  model: z.enum(['tts-1', 'tts-1-hd']).optional(),
  speed: z.number().min(0.25).max(4.0).optional(),
  responseFormat: z.enum(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']).optional(),
});

export type WhisperInput = z.infer<typeof WhisperInputSchema>;
export type TTSInput = z.infer<typeof TTSInputSchema>;

// ============================================================================
// WHISPER TOOL
// ============================================================================

/**
 * Whisper transcription tool definition
 */
export const whisperTool = {
  name: 'whisper_transcribe',
  description: 'Transcribe audio to text using OpenAI Whisper. Supports multiple languages including Kinyarwanda, English, and French.',
  parameters: {
    type: 'object',
    properties: {
      audio: { type: 'string', description: 'Base64 encoded audio data' },
      language: { type: 'string', description: 'Language code (e.g., "en", "rw", "fr")' },
      prompt: { type: 'string', description: 'Optional prompt to guide transcription' },
    },
    required: ['audio'],
  },
  handler: transcribeAudio,
};

/**
 * Transcribe audio using OpenAI Whisper
 */
export async function transcribeAudio(
  input: WhisperInput,
  context?: { openaiApiKey?: string },
): Promise<TranscriptionResult> {
  const OpenAI = (await import('openai')).default;
  const apiKey = context?.openaiApiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const client = new OpenAI({ apiKey });
  const startTime = Date.now();

  try {
    // Convert base64 to Buffer
    const audioBuffer = Buffer.from(input.audio, 'base64');

    // Create a File-like object for the API
    const file = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' });

    const response = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: input.language,
      prompt: input.prompt,
      response_format: input.responseFormat || 'json',
    });

    const duration = Date.now() - startTime;

    log.info(
      {
        event: 'WHISPER_TRANSCRIPTION',
        language: input.language,
        durationMs: duration,
      },
      'Audio transcribed successfully',
    );

    // Handle different response formats
    if (typeof response === 'string') {
      return { text: response };
    }

    return {
      text: response.text,
      language: input.language,
      duration,
    };
  } catch (error) {
    log.error(
      {
        event: 'WHISPER_ERROR',
        error: error instanceof Error ? error.message : String(error),
      },
      'Whisper transcription failed',
    );
    throw error;
  }
}

// ============================================================================
// TTS TOOL
// ============================================================================

/**
 * TTS tool definition
 */
export const ttsTool = {
  name: 'text_to_speech',
  description: 'Convert text to speech using OpenAI TTS. Supports multiple voices and audio formats.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to convert to speech' },
      voice: {
        type: 'string',
        enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
        description: 'Voice to use',
      },
      model: {
        type: 'string',
        enum: ['tts-1', 'tts-1-hd'],
        description: 'TTS model (tts-1 for speed, tts-1-hd for quality)',
      },
      speed: { type: 'number', description: 'Speed (0.25 to 4.0)' },
    },
    required: ['text'],
  },
  handler: generateSpeech,
};

/**
 * Generate speech from text using OpenAI TTS
 */
export async function generateSpeech(
  input: TTSInput,
  context?: { openaiApiKey?: string },
): Promise<TTSResult> {
  const OpenAI = (await import('openai')).default;
  const apiKey = context?.openaiApiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const client = new OpenAI({ apiKey });
  const startTime = Date.now();

  try {
    const response = await client.audio.speech.create({
      model: input.model || 'tts-1',
      voice: input.voice || 'alloy',
      input: input.text,
      speed: input.speed || 1.0,
      response_format: input.responseFormat || 'mp3',
    });

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const duration = Date.now() - startTime;

    log.info(
      {
        event: 'TTS_GENERATION',
        voice: input.voice || 'alloy',
        textLength: input.text.length,
        durationMs: duration,
      },
      'Speech generated successfully',
    );

    return {
      audio: audioBuffer,
      format: input.responseFormat || 'mp3',
      duration,
    };
  } catch (error) {
    log.error(
      {
        event: 'TTS_ERROR',
        error: error instanceof Error ? error.message : String(error),
      },
      'TTS generation failed',
    );
    throw error;
  }
}

// ============================================================================
// VOICE TOOLS REGISTRY
// ============================================================================

export const VOICE_TOOLS = {
  whisper_transcribe: whisperTool,
  text_to_speech: ttsTool,
};

/**
 * Get all voice tool schemas for function calling
 */
export function getVoiceToolSchemas(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return Object.values(VOICE_TOOLS).map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
