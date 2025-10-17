import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockApi } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    mockApi: {
      getSettings: fn(),
      saveSettings: fn(),
      getUsers: fn(),
      listTrips: fn(),
      closeTrip: fn(),
      listSubs: fn(),
      approveSub: fn(),
      rejectSub: fn(),
      getStats: fn(),
      simulatorDrivers: fn(),
      simulatorPassengers: fn(),
      simulatorSchedulePassenger: fn(),
      simulatorScheduleDriver: fn(),
      simulatorProfile: fn(),
    },
  };
});

vi.mock('./api', () => ({
  AdminAPI: mockApi,
}));

import { RealAdapter } from './adapter.real';

describe('RealAdapter (Edge Function delegation)', () => {
  beforeEach(() => {
    Object.values(mockApi).forEach((fn) => {
      fn.mockReset();
    });
  });

  it('normalizes admin WhatsApp numbers from settings', async () => {
    mockApi.getSettings.mockResolvedValueOnce({
      subscription_price: 5000,
      search_radius_km: 5,
      max_results: 10,
      momo_payee_number: '0780000000',
      support_phone_e164: '+250780000000',
      admin_whatsapp_numbers: ['250780000001', '250780000002'],
    });

    const adapter = new RealAdapter('/functions/v1', 'token');
    const settings = await adapter.getSettings();

    expect(mockApi.getSettings).toHaveBeenCalledTimes(1);
    expect(settings.admin_whatsapp_numbers).toBe('250780000001,250780000002');
  });

  it('delegates updateTripStatus to the closeTrip action for expired trips', async () => {
    mockApi.closeTrip.mockResolvedValueOnce(undefined);

    const adapter = new RealAdapter('/functions/v1', 'token');
    await adapter.updateTripStatus(42, 'expired');

    expect(mockApi.closeTrip).toHaveBeenCalledWith(42);
  });

  it('returns NO_ACCESS when simulator passengers deny access', async () => {
    mockApi.simulatorPassengers.mockResolvedValueOnce({ access: false, reason: 'no_subscription' });

    const adapter = new RealAdapter('/functions/v1', 'token');
    const result = await adapter.simulateSeeNearbyPassengers({
      lat: -1.95,
      lng: 30.06,
      vehicle_type: 'moto',
    });

    expect(result).toBe('NO_ACCESS');
    expect(mockApi.simulatorPassengers).toHaveBeenCalledWith({
      lat: -1.95,
      lng: 30.06,
      vehicle_type: 'moto',
      driver_ref_code: undefined,
      force_access: undefined,
      radius_km: undefined,
      max: undefined,
    });
  });
});
