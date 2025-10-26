import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminApiRequest } from './utils/api';

describe('mobility ping drivers route', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LOG_DRAIN_URL;
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    delete process.env.LOG_DRAIN_URL;
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns aggregated metadata when all fan-outs succeed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const { POST } = await import('@/app/api/mobility/ping_drivers/route');

    const response = await POST(
      createAdminApiRequest(
        ['mobility', 'ping_drivers'],
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ride_id: 'ride-1',
            driver_ids: ['driver-a', 'driver-b'],
            template: { name: 'DRIVER_PING' },
          }),
        },
      ) as any,
    );

    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload).toMatchObject({ ride_id: 'ride-1', queued: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports partial failures with diagnostics and degraded status', async () => {
    const successResponse = new Response(null, { status: 202 });
    const failureResponse = new Response(JSON.stringify({ error: 'boom' }), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/json' },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failureResponse)
      .mockResolvedValueOnce(successResponse);
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const { POST } = await import('@/app/api/mobility/ping_drivers/route');

    const response = await POST(
      createAdminApiRequest(
        ['mobility', 'ping_drivers'],
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ride_id: 'ride-2', driver_ids: ['driver-x', 'driver-y'] }),
        },
      ) as any,
    );

    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload).toMatchObject({ ride_id: 'ride-2', queued: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
