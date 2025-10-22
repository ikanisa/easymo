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

export const env = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  baseUrl: process.env.BACKEND_BASE_URL ?? 'http://localhost:4000',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  waToken: process.env.WABA_ACCESS_TOKEN ?? '',
  waPhoneId: process.env.WABA_PHONE_NUMBER_ID ?? '',
  waVerifyToken: process.env.WA_VERIFY_TOKEN ?? process.env.WHATSAPP_VERIFY_TOKEN ?? '',
  waGraphApiBaseUrl: process.env.WHATSAPP_API_BASE_URL ?? process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v21.0',
  twilioSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuth: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioSipDomain: process.env.TWILIO_SIP_DOMAIN ?? '',
  openaiWebhookSecret: process.env.OPENAI_REALTIME_SIP_WEBHOOK_SECRET ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  realtimeModel: process.env.REALTIME_MODEL ?? 'gpt-realtime',
  realtimeWsUrl: process.env.REALTIME_WS_URL ?? '',
  jwtSigningKey: process.env.JWT_SIGNING_KEY ?? 'dev',
  voiceAgentDefault: process.env.VOICE_AGENT_DEFAULT ?? 'sales',
  voiceAgentProjectMap: parseRecord(process.env.VOICE_AGENT_PROJECT_MAP),
  voiceAgentNumberMap: parseRecord(process.env.VOICE_AGENT_NUMBER_MAP),
  bridgeSharedSecret: process.env.BRIDGE_SHARED_SECRET ?? '',
  turnServers: parseStringArray(process.env.TURN_URIS),
  turnUsername: process.env.TURN_USERNAME ?? '',
  turnPassword: process.env.TURN_PASSWORD ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
};
