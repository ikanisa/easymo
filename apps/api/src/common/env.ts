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

export const env = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  baseUrl: process.env.BACKEND_BASE_URL ?? 'http://localhost:4000',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  waToken: process.env.WABA_ACCESS_TOKEN ?? '',
  waPhoneId: process.env.WABA_PHONE_NUMBER_ID ?? '',
  twilioSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuth: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioSipDomain: process.env.TWILIO_SIP_DOMAIN ?? '',
  openaiWebhookSecret: process.env.OPENAI_REALTIME_SIP_WEBHOOK_SECRET ?? '',
  jwtSigningKey: process.env.JWT_SIGNING_KEY ?? 'dev',
  voiceAgentDefault: process.env.VOICE_AGENT_DEFAULT ?? 'sales',
  voiceAgentProjectMap: parseRecord(process.env.VOICE_AGENT_PROJECT_MAP),
  voiceAgentNumberMap: parseRecord(process.env.VOICE_AGENT_NUMBER_MAP),
  bridgeSharedSecret: process.env.BRIDGE_SHARED_SECRET ?? '',
};
