import { z } from 'zod';

function parseRecord(input: string | undefined): Record<string, string> {
  if (!input) {
    return {};
  }
  try {
    const parsed = JSON.parse(input);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed)
          .filter(([key, value]) => typeof key === 'string' && typeof value === 'string')
          .map(([key, value]) => [key, value as string]),
      );
    }
  } catch {
    // swallow parse error; fall through to empty object
  }
  return {};
}

function parseStringArray(input: string | undefined): string[] {
  if (!input) {
    return [];
  }
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string');
    }
  } catch {
    // ignore malformed payloads
  }
  return [];
}

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const SupabaseConfigSchema = z.object({
  url: z.string().url(),
  serviceRoleKey: z.string().min(1),
});

function resolveSupabaseConfig() {
  const url =
    readEnv('SUPABASE_URL') ??
    readEnv('SERVICE_URL') ??
    readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey =
    readEnv('SUPABASE_SERVICE_ROLE_KEY') ??
    readEnv('SERVICE_ROLE_KEY');

  const parsed = SupabaseConfigSchema.safeParse({ url, serviceRoleKey });
  if (!parsed.success) {
    throw new Error(
      'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or provide SERVICE_URL/SERVICE_ROLE_KEY).',
    );
  }

  return parsed.data;
}

const supabaseConfig = resolveSupabaseConfig();

const port = z.coerce.number().int().nonnegative().catch(4000).parse(readEnv('PORT'));

const jwtSigningKey = readEnv('JWT_SIGNING_KEY');
if (!jwtSigningKey || jwtSigningKey === 'dev') {
  throw new Error('JWT_SIGNING_KEY must be set to a non-default value.');
}

const metaAppSecret = readEnv('WA_APP_SECRET') ?? readEnv('META_APP_SECRET');
if (!metaAppSecret) {
  throw new Error('WA_APP_SECRET (or META_APP_SECRET) must be configured to validate WhatsApp callbacks.');
}

export const env = {
  port,
  baseUrl: readEnv('BACKEND_BASE_URL') ?? 'http://localhost:4000',
  supabaseUrl: supabaseConfig.url,
  supabaseKey: supabaseConfig.serviceRoleKey,
  waToken: readEnv('WABA_ACCESS_TOKEN') ?? '',
  waPhoneId: readEnv('WABA_PHONE_NUMBER_ID') ?? '',
  waVerifyToken: readEnv('WA_VERIFY_TOKEN') ?? readEnv('WHATSAPP_VERIFY_TOKEN') ?? '',
  waGraphApiBaseUrl:
    readEnv('WHATSAPP_API_BASE_URL') ??
    readEnv('WHATSAPP_API_URL') ??
    'https://graph.facebook.com/v21.0',
  twilioSid: readEnv('TWILIO_ACCOUNT_SID') ?? '',
  twilioAuth: readEnv('TWILIO_AUTH_TOKEN') ?? '',
  twilioSipDomain: readEnv('TWILIO_SIP_DOMAIN') ?? '',
  openaiWebhookSecret: readEnv('OPENAI_REALTIME_SIP_WEBHOOK_SECRET') ?? '',
  openaiApiKey: readEnv('OPENAI_API_KEY') ?? '',
  realtimeModel: readEnv('REALTIME_MODEL') ?? 'gpt-realtime',
  realtimeWsUrl: readEnv('REALTIME_WS_URL') ?? '',
  jwtSigningKey,
  metaAppSecret,
  voiceAgentDefault: readEnv('VOICE_AGENT_DEFAULT') ?? 'sales',
  voiceAgentProjectMap: parseRecord(readEnv('VOICE_AGENT_PROJECT_MAP')),
  voiceAgentNumberMap: parseRecord(readEnv('VOICE_AGENT_NUMBER_MAP')),
  bridgeSharedSecret: readEnv('BRIDGE_SHARED_SECRET') ?? '',
  turnServers: parseStringArray(readEnv('TURN_URIS')),
  turnUsername: readEnv('TURN_USERNAME') ?? '',
  turnPassword: readEnv('TURN_PASSWORD') ?? '',
  redisUrl: readEnv('REDIS_URL') ?? '',
};
