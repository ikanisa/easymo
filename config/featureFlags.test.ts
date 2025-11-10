import { afterEach, describe, expect, it, vi } from 'vitest';

type MutableEnv = NodeJS.ProcessEnv & Record<string, string | undefined>;
const originalEnv: MutableEnv = { ...process.env };

async function importFlags() {
  return import('./featureFlags.ts');
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('feature flags', () => {
  it('treats missing flags as disabled by default', async () => {
    const { AgentFeatureFlags, getEnabledFeatures } = await importFlags();
    expect(AgentFeatureFlags.ENABLE_AGENT_CHAT).toBe(false);
    expect(getEnabledFeatures()).toEqual([]);
  });

  it('detects enabled flags across supported truthy values', async () => {
    process.env = {
      ...originalEnv,
      FEATURE_AGENT_CHAT: 'true',
      FEATURE_AGENT_VOICE: '1',
    };

    const { AgentFeatureFlags, isFeatureEnabled, getEnabledFeatures } = await importFlags();
    expect(AgentFeatureFlags.ENABLE_AGENT_CHAT).toBe(true);
    expect(isFeatureEnabled('ENABLE_AGENT_VOICE')).toBe(true);
    expect(getEnabledFeatures()).toEqual(
      expect.arrayContaining([
        'ENABLE_AGENT_CHAT',
        'ENABLE_AGENT_VOICE',
      ]),
    );
  });

  it('logs current status when requested', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env = {
      ...originalEnv,
      FEATURE_AGENT_CHAT: 'true',
    };
    const { logFeatureFlags } = await importFlags();
    logFeatureFlags();
    expect(consoleSpy).toHaveBeenCalledWith('Feature flags status:', {
      enabled: expect.arrayContaining(['ENABLE_AGENT_CHAT']),
      all: expect.any(Object),
    });
  });
});
