import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminApiRequest } from './utils/api';

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/server/logger', () => ({
  logStructured: vi.fn(),
}));

vi.mock('@/lib/server/feature-flags', () => ({
  isFeatureEnabled: vi.fn(() => true),
}));

describe('match search route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  it('returns dual-constraint filtered candidates', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'candidate-a',
          kind: 'offer',
          pickup_distance_km: 8,
          dropoff_distance_km: 9,
          created_at: '2025-10-01T10:00:00Z',
        },
      ],
      error: null,
    });
    getSupabaseAdminClient.mockReturnValue({ rpc });

    const { POST } = await import('@/app/api/match/search/route');

    const response = await POST(
      createAdminApiRequest(
        ['match', 'search'],
        {
          method: 'POST',
          body: JSON.stringify({
            actor_kind: 'driver',
            pickup: { lat: 0.1, lng: 32.5 },
            dropoff: { lat: 0.2, lng: 32.6 },
            radius_km: 10,
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({ id: 'candidate-a', pickupDistanceKm: 8, dropoffDistanceKm: 9 });
    expect(rpc).toHaveBeenCalledWith('match_search_candidates', expect.objectContaining({
      actor_kind: 'driver',
      require_dual: true,
    }));
  });

  it('keeps single-radius matching when dropoff missing', async () => {
    const { getSupabaseAdminClient } = (await import('@/lib/server/supabase-admin')) as {
      getSupabaseAdminClient: ReturnType<typeof vi.fn>;
    };
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    getSupabaseAdminClient.mockReturnValue({ rpc });

    const { POST } = await import('@/app/api/match/search/route');

    const response = await POST(
      createAdminApiRequest(
        ['match', 'search'],
        {
          method: 'POST',
          body: JSON.stringify({
            actor_kind: 'passenger',
            pickup: { lat: -1.9, lng: 30.1 },
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('match_search_candidates', expect.objectContaining({
      require_dual: false,
      dropoff_lat: null,
      dropoff_lng: null,
    }));
  });
});
