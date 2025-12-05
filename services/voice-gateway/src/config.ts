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

  // AI Provider Selection
  // Options: 'openai' | 'google'
  VOICE_STT_PROVIDER: process.env.VOICE_STT_PROVIDER || 'openai',
  VOICE_TTS_PROVIDER: process.env.VOICE_TTS_PROVIDER || 'openai',
  VOICE_TRANSLATE_PROVIDER: process.env.VOICE_TRANSLATE_PROVIDER || 'google',
  VOICE_ENABLE_FALLBACK: process.env.VOICE_ENABLE_FALLBACK !== 'false',

  // SBC/Telephony
  SBC_ENDPOINT: process.env.SBC_ENDPOINT || '',
  DEFAULT_FROM_NUMBER: process.env.DEFAULT_FROM_NUMBER || '',

  // SIP Configuration
  // OpenAI SIP Trunk
  OPENAI_SIP_ENDPOINT: process.env.OPENAI_SIP_ENDPOINT || '',
  OPENAI_SIP_USERNAME: process.env.OPENAI_SIP_USERNAME || '',
  OPENAI_SIP_PASSWORD: process.env.OPENAI_SIP_PASSWORD || '',
  
  // MTN SIP Trunk
  MTN_SIP_ENDPOINT: process.env.MTN_SIP_ENDPOINT || '',
  MTN_SIP_USERNAME: process.env.MTN_SIP_USERNAME || '',
  MTN_SIP_PASSWORD: process.env.MTN_SIP_PASSWORD || '',
  MTN_SIP_REALM: process.env.MTN_SIP_REALM || 'mtn.rw',
  
  // Phone Number Routing
  VOICE_DID_NUMBERS: (process.env.VOICE_DID_NUMBERS || '').split(',').filter(Boolean),

  // Audio settings
  AUDIO_SAMPLE_RATE: 8000,
  AUDIO_ENCODING: 'MULAW' as const,

  // Timeouts
  CALL_TIMEOUT_MS: parseInt(process.env.CALL_TIMEOUT_MS || '300000', 10), // 5 minutes
  TRANSCRIPTION_TIMEOUT_MS: parseInt(process.env.TRANSCRIPTION_TIMEOUT_MS || '30000', 10),

  // AGI Tool Configuration
  AGI_TOOLS_ENABLED: process.env.AGI_TOOLS_ENABLED !== 'false',
  AGI_SUPABASE_FUNCTIONS_URL: process.env.AGI_SUPABASE_FUNCTIONS_URL || process.env.SUPABASE_URL?.replace('.supabase.co', '.supabase.co/functions/v1') || '',
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
