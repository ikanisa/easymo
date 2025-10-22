import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAdminApiRequest } from './utils/api';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

vi.mock('@/lib/server/audit', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

const headersGetMock = vi.fn((_key: string) => null);
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({ get: headersGetMock })),
}));

describe('memberships PATCH route', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    process.env = { ...originalEnv };
    headersGetMock.mockImplementation((k: string) => k === 'x-actor-id' ? '00000000-0000-0000-0000-000000000123' : null);
  });
  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('updates membership status', async () => {
    const { getSupabaseAdminClient } = await import('@/lib/server/supabase-admin');

    const update = vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: 'mem-1', status: 'active' }, error: null })) })) })) }));
    const from = vi.fn(() => ({ update }));
    getSupabaseAdminClient.mockReturnValue({ from });

    const { PATCH } = await import('@/app/api/baskets/memberships/[id]/route');
    const req = createAdminApiRequest(['baskets', 'memberships', 'abc'], {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    });
    const res = await PATCH(req, { params: { id: 'mem-1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });
});

