import { afterEach, describe, expect, it, vi } from 'vitest';

type MutableEnv = NodeJS.ProcessEnv & Record<string, string | undefined>;
const baselineEnv: MutableEnv = { ...process.env };

async function loadEnvModule() {
  vi.resetModules();
  return import('../../../apps/api/src/common/env.ts');
}

afterEach(() => {
  process.env = { ...baselineEnv };
  vi.resetModules();
});

describe('apps/api env parsing', () => {
  it('computes configuration from standard variables', async () => {
    process.env = {
      ...baselineEnv,
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      JWT_SIGNING_KEY: 'signing',
      WA_APP_SECRET: 'wa-secret',
      PORT: '8081',
      VOICE_AGENT_PROJECT_MAP: JSON.stringify({ sales: 'proj-sales' }),
      VOICE_AGENT_NUMBER_MAP: JSON.stringify({ '+2507': 'sales' }),
      TURN_URIS: JSON.stringify(['turn:demo:3478']),
    };

    const { env } = await loadEnvModule();
    expect(env.port).toBe(8081);
    expect(env.supabaseUrl).toBe('https://demo.supabase.co');
    expect(env.supabaseKey).toBe('service-role');
    expect(env.voiceAgentProjectMap).toEqual({ sales: 'proj-sales' });
    expect(env.turnServers).toEqual(['turn:demo:3478']);
    expect(env.deeplinkSecret).toBe('signing');
  });

  it('throws when required secrets are missing', async () => {
    process.env = {
      ...baselineEnv,
      JWT_SIGNING_KEY: 'dev',
    };
    await expect(loadEnvModule()).rejects.toThrow(/SUPABASE_URL/);
  });

  it('allows override of service keys and defaults port on invalid values', async () => {
    process.env = {
      ...baselineEnv,
      SERVICE_URL: 'https://alt.supabase.co',
      SERVICE_ROLE_KEY: 'override',
      JWT_SIGNING_KEY: 'secret',
      META_APP_SECRET: 'meta-secret',
      PORT: 'abc',
    };
    const { env } = await loadEnvModule();
    expect(env.supabaseUrl).toBe('https://alt.supabase.co');
    expect(env.supabaseKey).toBe('override');
    expect(env.port).toBe(4000);
    expect(env.metaAppSecret).toBe('meta-secret');
  });
});
