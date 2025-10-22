import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminApiUrl } from './utils/api';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

describe('deeplink join route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  it('resolves a valid token to basket metadata', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const tokenMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'token-1',
        token: 'abc123',
        basket_id: 'basket-1',
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        used_at: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    });
    const tokenEq = vi.fn().mockReturnValue({ maybeSingle: tokenMaybeSingle });
    const tokenSelect = vi.fn().mockReturnValue({ eq: tokenEq });

    const basketMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'basket-1',
        name: 'My Basket',
        creator_id: 'user-1',
        created_at: '2025-10-10T00:00:00Z',
      },
      error: null,
    });
    const basketEq = vi.fn().mockReturnValue({ maybeSingle: basketMaybeSingle });
    const basketSelect = vi.fn().mockReturnValue({ eq: basketEq });

    getSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'basket_invite_tokens') {
          return { select: tokenSelect };
        }
        if (table === 'baskets') {
          return { select: basketSelect };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const { GET } = await import('@/app/api/deeplink/join/route');

    const response = await GET(new Request(getAdminApiUrl(['deeplink', 'join'], 't=abc123')));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      basket: { id: 'basket-1', name: 'My Basket' },
      token: 'abc123',
    });
  });

  it('returns 410 when token expired', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const tokenMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'token-1',
        token: 'expired',
        basket_id: 'basket-1',
        expires_at: new Date(Date.now() - 1000).toISOString(),
        used_at: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    });
    const tokenEq = vi.fn().mockReturnValue({ maybeSingle: tokenMaybeSingle });
    const tokenSelect = vi.fn().mockReturnValue({ eq: tokenEq });

    getSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'basket_invite_tokens') {
          return { select: tokenSelect };
        }
        if (table === 'baskets') {
          return { select: vi.fn() };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const { GET } = await import('@/app/api/deeplink/join/route');

    const response = await GET(new Request(getAdminApiUrl(['deeplink', 'join'], 't=expired')));
    expect(response.status).toBe(410);
  });
});
