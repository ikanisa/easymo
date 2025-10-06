import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/server/audit', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

vi.mock('@/lib/server/idempotency', () => ({
  withIdempotency: vi.fn(async (_key: string | undefined, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@/lib/server/edge-bridges', () => ({
  callBridge: vi.fn().mockResolvedValue({ ok: true, data: { issuedCount: 1 } }),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((key: string) =>
      key === 'x-actor-id' ? '00000000-0000-0000-0000-000000000000' : null
    ),
  })),
}));

const originalEnv = { ...process.env };

describe('voucher generate API', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_USE_MOCKS: 'false' };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  it('creates vouchers and returns integration details', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const insertedRows = [{
      id: 'v-1',
      code5: 'KABCDE',
      amount: 2500,
      currency: 'RWF',
      expires_at: null,
      status: 'issued',
    }];

    const select = vi.fn().mockResolvedValue({ data: insertedRows, error: null });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn(() => ({ insert }));
    getSupabaseAdminClient.mockReturnValue({ from });

    const { POST } = await import('@/app/api/vouchers/generate/route');
    const request = new Request('http://localhost/api/vouchers/generate', {
      method: 'POST',
      body: JSON.stringify({
        amount: 2500,
        currency: 'RWF',
        recipients: [{ msisdn: '+250700000001' }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.vouchers).toHaveLength(1);
    expect(payload.integration.status).toBe('ok');
    expect(insert).toHaveBeenCalled();
  });

  it('returns degraded response when Supabase client missing', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    getSupabaseAdminClient.mockReturnValue(null);

    const { POST } = await import('@/app/api/vouchers/generate/route');
    const request = new Request('http://localhost/api/vouchers/generate', {
      method: 'POST',
      body: JSON.stringify({
        amount: 2500,
        currency: 'RWF',
        recipients: [{ msisdn: '+250700000001' }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error).toBe('supabase_unavailable');
  });
});
