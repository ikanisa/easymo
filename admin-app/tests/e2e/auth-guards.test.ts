import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAdminApiRequest } from './utils/api';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: () => ({ upsert: () => ({}) }),
  })),
}));

const headersGetMock = vi.fn((_key: string) => null);
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({ get: headersGetMock })),
}));

describe('auth guards', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_PUBLIC_USE_MOCKS: 'false' };
    headersGetMock.mockImplementation((_key: string) => null);
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  it('allows settings update with default test actor id', async () => {
    const { POST } = await import('@/app/api/settings/route');
    const response = await POST(createAdminApiRequest(['settings'], {
      method: 'POST',
      body: JSON.stringify({
        quietHours: { start: '22:00', end: '06:00' },
        throttlePerMinute: 10,
        optOutList: [],
      }),
    }));
    expect(response.status).toBe(200);
  });
});
