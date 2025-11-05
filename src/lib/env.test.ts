import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAdminToken,
  getApiBase,
  getMobilityUserId,
  getMobilityUserRoles,
  getOpenAiVectorStoreId,
  getSupabaseAnonKey,
  getSupabaseProjectId,
  getSupabaseUrl,
  isAgentChatEnabled,
  isDev,
  shouldUseMock,
  showDevTools,
} from './env';

const originalEnv = { ...import.meta.env } as Record<string, string>;

describe('Environment configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Object.assign(import.meta.env, originalEnv);
  });

  it('detects dev mode from Vite flag', () => {
    const originalDev = import.meta.env.DEV;
    (import.meta.env as Record<string, any>).DEV = true;
    expect(isDev()).toBe(true);
    (import.meta.env as Record<string, any>).DEV = false;
    expect(isDev()).toBe(false);
    (import.meta.env as Record<string, any>).DEV = originalDev;
  });

  it('enables mock mode for multiple truthy values', () => {
    vi.stubEnv('VITE_USE_MOCK', '1');
    expect(shouldUseMock()).toBe(true);
    vi.stubEnv('VITE_USE_MOCK', 'true');
    expect(shouldUseMock()).toBe(true);
    vi.stubEnv('VITE_USE_MOCK', '0');
    expect(shouldUseMock()).toBe(false);
  });

  it('controls developer tools toggle separately from mocks', () => {
    vi.stubEnv('VITE_DEV_TOOLS', '1');
    expect(showDevTools()).toBe(true);
    vi.stubEnv('VITE_DEV_TOOLS', '0');
    expect(showDevTools()).toBe(false);
  });

  it('evaluates agent chat feature toggle using permissive truthy inputs', () => {
    vi.stubEnv('VITE_ENABLE_AGENT_CHAT', 'YeS');
    expect(isAgentChatEnabled()).toBe(true);
    vi.stubEnv('VITE_ENABLE_AGENT_CHAT', 'no');
    expect(isAgentChatEnabled()).toBe(false);
  });

  it('reads admin token from env before falling back to local storage', () => {
    vi.stubEnv('VITE_ADMIN_TOKEN', 'env-token');
    expect(getAdminToken()).toBe('env-token');
    vi.stubEnv('VITE_ADMIN_TOKEN', '');
    const storageGet = vi.fn().mockReturnValue('stored');
    vi.stubGlobal('window', { localStorage: { getItem: storageGet } });
    expect(getAdminToken()).toBe('stored');
    vi.stubGlobal('window', undefined);
  });

  it('returns sensible defaults for API base and mobility identity', () => {
    expect(getApiBase()).toBe('/functions/v1');
    expect(getMobilityUserId()).toBe('00000000-0000-4000-8000-000000000001');
    expect(getMobilityUserRoles()).toBe('admin');
  });

  it('derives Supabase project id from URL fallback', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example-project.supabase.co');
    expect(getSupabaseProjectId()).toBe('example-project');
    vi.stubEnv('VITE_SUPABASE_PROJECT_ID', 'explicit-id');
    expect(getSupabaseProjectId()).toBe('explicit-id');
  });

  it('reads Supabase credentials with trimming behaviour', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '   https://demo.supabase.co  ');
    expect(getSupabaseUrl()).toBe('https://demo.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '  anon-key  ');
    expect(getSupabaseAnonKey()).toBe('anon-key');
  });

  it('handles optional OpenAI vector store identifiers', () => {
    expect(getOpenAiVectorStoreId()).toBeUndefined();
    vi.stubEnv('VITE_OPENAI_VECTOR_STORE_ID', ' store-123 ');
    expect(getOpenAiVectorStoreId()).toBe('store-123');
    vi.stubEnv('VITE_OPENAI_VECTOR_STORE_ID', '   ');
    expect(getOpenAiVectorStoreId()).toBeUndefined();
  });
});
