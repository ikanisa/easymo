import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockSupabaseClient = {} as SupabaseClient;

vi.mock('./supabase-client', () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('./supabase-admin-service', () => ({
  fetchSettings: vi.fn(),
  updateSettings: vi.fn(),
  listUsers: vi.fn(),
  listTrips: vi.fn(),
  listSubscriptions: vi.fn(),
  approveSubscription: vi.fn(),
  rejectSubscription: vi.fn(),
  fetchAdminStats: vi.fn(),
  simulateSeeNearbyDrivers: vi.fn(),
  simulateSeeNearbyPassengers: vi.fn(),
  simulateScheduleTripPassenger: vi.fn(),
  simulateScheduleTripDriver: vi.fn(),
  getProfileByRefCode: vi.fn(),
}));

// Import after mocks
import { RealAdapter } from './adapter.real';
import * as serviceModule from './supabase-admin-service';

const createAdapter = () => new RealAdapter(mockSupabaseClient);
const getMocks = () => serviceModule as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('RealAdapter', () => {
  beforeEach(() => {
    const mocks = getMocks();
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it('delegates getSettings to service', async () => {
    const mocks = getMocks();
    const settings = { subscription_price: 5000 } as any;
    mocks.fetchSettings.mockResolvedValue(settings);

    const adapter = createAdapter();
    const result = await adapter.getSettings();

    expect(mocks.fetchSettings).toHaveBeenCalledWith(mockSupabaseClient);
    expect(result).toBe(settings);
  });

  it('approves subscriptions via service', async () => {
    const mocks = getMocks();
    mocks.approveSubscription.mockResolvedValue(undefined);
    const adapter = createAdapter();

    await adapter.approveSubscription(42, 'txn');

    expect(mocks.approveSubscription).toHaveBeenCalledWith(42, 'txn', mockSupabaseClient);
  });

  it('rejects subscriptions via service with reason', async () => {
    const mocks = getMocks();
    mocks.rejectSubscription.mockResolvedValue(undefined);
    const adapter = createAdapter();

    await adapter.rejectSubscription(13, 'invalid');

    expect(mocks.rejectSubscription).toHaveBeenCalledWith(13, 'invalid', mockSupabaseClient);
  });

  it('maps simulator passenger access denials to NO_ACCESS', async () => {
    const mocks = getMocks();
    mocks.simulateSeeNearbyPassengers.mockResolvedValue({ access: false, reason: 'no_subscription' });

    const adapter = createAdapter();
    const result = await adapter.simulateSeeNearbyPassengers({ lat: 0, lng: 0, vehicle_type: 'moto' });

    expect(result).toBe('NO_ACCESS');
    expect(mocks.simulateSeeNearbyPassengers).toHaveBeenCalledWith(
      {
        lat: 0,
        lng: 0,
        vehicle_type: 'moto',
        force_access: undefined,
        driver_ref_code: undefined,
        radius_km: undefined,
        max: undefined,
      },
      mockSupabaseClient,
    );
  });

  it('returns trips when passengers accessible', async () => {
    const mocks = getMocks();
    const trips = [{ id: 1 }] as any;
    mocks.simulateSeeNearbyPassengers.mockResolvedValue({ access: true, trips });

    const adapter = createAdapter();
    const result = await adapter.simulateSeeNearbyPassengers({ lat: 1, lng: 2, vehicle_type: 'moto' });

    expect(result).toEqual(trips);
  });

  it('requires passenger ref code when scheduling trip', async () => {
    const adapter = createAdapter();
    await expect(
      adapter.simulateScheduleTripPassenger({ lat: 1, lng: 2, vehicle_type: 'moto' }),
    ).rejects.toThrow('Passenger ref code required in live mode');
  });

  it('schedules passenger trips via service', async () => {
    const mocks = getMocks();
    const trip = { id: 99 } as any;
    mocks.simulateScheduleTripPassenger.mockResolvedValue(trip);

    const adapter = createAdapter();
    const result = await adapter.simulateScheduleTripPassenger({ lat: 1, lng: 2, vehicle_type: 'moto', refCode: 'ABC' });

    expect(result).toBe(trip);
    expect(mocks.simulateScheduleTripPassenger).toHaveBeenCalledWith(
      { lat: 1, lng: 2, vehicle_type: 'moto', ref_code: 'ABC' },
      mockSupabaseClient,
    );
  });

  it('returns NO_ACCESS when schedule driver denied', async () => {
    const mocks = getMocks();
    mocks.simulateScheduleTripDriver.mockResolvedValue({ access: false, reason: 'no_subscription' });

    const adapter = createAdapter();
    const result = await adapter.simulateScheduleTripDriver({ lat: 1, lng: 2, vehicle_type: 'moto', hasAccess: false, refCode: 'DRV' });

    expect(result).toBe('NO_ACCESS');
  });

  it('returns trip when schedule driver allowed', async () => {
    const mocks = getMocks();
    const trip = { id: 2 } as any;
    mocks.simulateScheduleTripDriver.mockResolvedValue({ access: true, trip });

    const adapter = createAdapter();
    const result = await adapter.simulateScheduleTripDriver({ lat: 1, lng: 2, vehicle_type: 'moto', hasAccess: true, refCode: 'DRV' });

    expect(result).toBe(trip);
  });
});
