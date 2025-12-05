/**
 * Voice Gateway Configuration
 */

import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  // Server
  PORT: parseInt(process.env.VOICE_GATEWAY_PORT || '3030', 10),
  HOST: process.env.VOICE_GATEWAY_HOST || '0.0.0.0',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Google Cloud
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || '',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview',

  // SBC/Telephony
  SBC_ENDPOINT: process.env.SBC_ENDPOINT || '',
  DEFAULT_FROM_NUMBER: process.env.DEFAULT_FROM_NUMBER || '',

  // Audio settings
  AUDIO_SAMPLE_RATE: 8000,
  AUDIO_ENCODING: 'MULAW' as const,

  // Timeouts
  CALL_TIMEOUT_MS: parseInt(process.env.CALL_TIMEOUT_MS || '300000', 10), // 5 minutes
  TRANSCRIPTION_TIMEOUT_MS: parseInt(process.env.TRANSCRIPTION_TIMEOUT_MS || '30000', 10),
};

export function validateConfig(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
  ];

  const missing = required.filter((key) => !config[key as keyof typeof config]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
