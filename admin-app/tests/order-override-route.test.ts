import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminApiRequest } from './utils/api';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/server/audit', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((key: string) =>
      key === 'x-actor-id' ? '00000000-0000-0000-0000-000000000000' : null
    ),
  })),
}));

const originalEnv = { ...process.env };

describe('orders override API', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_USE_MOCKS: 'false' };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  it('applies override successfully', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'order-123', status: 'cancelled' },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const insert = vi.fn().mockReturnValue(Promise.resolve());
    const from = vi.fn((table: string) => {
      if (table === 'orders') {
        return { update };
      }
      return { insert };
    });

    getSupabaseAdminClient.mockReturnValue({ from });

    const { POST } = await import('@/app/api/orders/[id]/override/route');
    const request = createAdminApiRequest(['orders', 'override'], {
      method: 'POST',
      body: JSON.stringify({ action: 'cancel', reason: 'Customer request' }),
    });

    const response = await POST(request, {
      params: { id: '11111111-1111-1111-1111-111111111111' },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe('cancelled');
    expect(update).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();

    const { recordAudit } = await import('@/lib/server/audit');
    expect(recordAudit).toHaveBeenCalled();
  });

  it('returns error when Supabase update fails', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };

    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn(() => ({ update }));

    getSupabaseAdminClient.mockReturnValue({ from });

    const { POST } = await import('@/app/api/orders/[id]/override/route');
    const request = createAdminApiRequest(['orders', 'override'], {
      method: 'POST',
      body: JSON.stringify({ action: 'cancel', reason: 'Customer request' }),
    });

    const response = await POST(request, {
      params: { id: '11111111-1111-1111-1111-111111111111' },
    });

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error).toBe('override_failed');
  });
});
