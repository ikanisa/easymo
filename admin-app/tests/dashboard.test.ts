import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mockDashboardKpis, mockTimeseries } from '@/lib/mock-data';

const originalEnv = { ...process.env };

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

describe('dashboard snapshot', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_USE_MOCKS: 'false' };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  it('returns Supabase snapshot when RPC succeeds', async () => {
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    // Simulate server-side environment.
    delete (globalThis as unknown as { window?: unknown }).window;

    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin') as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const expected = {
      kpis: [{ label: 'Active trips', value: '12', delta: '+8%' }],
      timeseries: [{ date: '2025-01-01T00:00:00Z', issued: 5, redeemed: 2 }],
    };
    getSupabaseAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: expected, error: null }),
    });

    const { getDashboardSnapshot } = await import('@/lib/data-provider');
    const result = await getDashboardSnapshot();
    expect(result).toEqual(expected);

    (globalThis as unknown as { window?: unknown }).window = originalWindow;
  });

  it('falls back to mocks when RPC fails', async () => {
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { window?: unknown }).window;

    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin') as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    getSupabaseAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('boom') }),
    });

    const { getDashboardSnapshot } = await import('@/lib/data-provider');
    const result = await getDashboardSnapshot();
    expect(result.kpis.length).toBe(mockDashboardKpis.length);
    expect(result.timeseries.length).toBe(mockTimeseries.length);

    (globalThis as unknown as { window?: unknown }).window = originalWindow;
  });
});
