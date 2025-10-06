import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

const originalEnv = { ...process.env };

describe('notifications API', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_USE_MOCKS: 'false' };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  it('returns 503 when Supabase credentials missing', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    getSupabaseAdminClient.mockReturnValue(null);

    const { GET } = await import('@/app/api/notifications/route');
    const response = await GET(new Request('http://localhost/api/notifications'));
    expect(response.status).toBe(503);
  });

  it('returns notifications when Supabase query succeeds', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const queryResult = {
      data: [{
        id: 'notif-1',
        to_role: 'ops',
        type: 'voucher',
        status: 'queued',
        created_at: '2025-10-06T12:00:00Z',
        sent_at: null,
      }],
      error: null,
      count: 1,
    };

    const builder: any = {
      select: vi.fn(function () { return builder; }),
      order: vi.fn(function () { return builder; }),
      range: vi.fn(function () { return builder; }),
      eq: vi.fn(function () { return builder; }),
      then: (resolve: (value: typeof queryResult) => void) => Promise.resolve(resolve(queryResult)),
    };

    const from = vi.fn(() => builder);
    getSupabaseAdminClient.mockReturnValue({ from });

    const { GET } = await import('@/app/api/notifications/route');
    const response = await GET(new Request('http://localhost/api/notifications'));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toHaveLength(1);
    expect(payload.total).toBe(1);
  });
});
