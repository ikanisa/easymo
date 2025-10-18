import { beforeEach, describe, expect, it, vi } from 'vitest';

const defaultSettings = {
  subscription_price: 5000,
  search_radius_km: 5,
  max_results: 10,
  momo_payee_number: '0780000000',
  support_phone_e164: '+250780000000',
  admin_whatsapp_numbers: ['+250780000001', '+250780000002'],
};

const updatedSettings = {
  ...defaultSettings,
  subscription_price: 6000,
  search_radius_km: 6,
  max_results: 8,
};

const { adminApiMock } = vi.hoisted(() => {
  const makeMock = () => vi.fn();
  return {
    adminApiMock: {
      getSettings: makeMock(),
      saveSettings: makeMock(),
      getUsers: makeMock(),
      listTrips: makeMock(),
      closeTrip: makeMock(),
      listSubs: makeMock(),
      approveSub: makeMock(),
      rejectSub: makeMock(),
      getStats: makeMock(),
      simulatorDrivers: makeMock(),
      simulatorPassengers: makeMock(),
      simulatorSchedulePassenger: makeMock(),
      simulatorScheduleDriver: makeMock(),
      simulatorProfile: makeMock(),
    },
  };
});

vi.mock('./api', () => ({
  AdminAPI: adminApiMock,
}));

import { RealAdapter } from './adapter.real';

describe('RealAdapter (legacy supabase spec)', () => {
  beforeEach(() => {
    Object.values(adminApiMock).forEach((mock) => mock.mockReset());
    adminApiMock.getSettings.mockResolvedValue(defaultSettings);
    adminApiMock.saveSettings.mockResolvedValue(updatedSettings);
  });

  it('should fetch settings', async () => {
    const adapter = new RealAdapter();
    const settings = await adapter.getSettings();

    expect(adminApiMock.getSettings).toHaveBeenCalledTimes(1);
    expect(settings.subscription_price).toBe(5000);
    expect(settings.search_radius_km).toBe(5);
    expect(settings.admin_whatsapp_numbers).toBe('+250780000001,+250780000002');
  });

  it('should update settings', async () => {
    const adapter = new RealAdapter();
    const updated = await adapter.updateSettings({ subscription_price: 6000 });

    expect(adminApiMock.saveSettings).toHaveBeenCalledWith({ subscription_price: 6000 });
    expect(updated.subscription_price).toBe(6000);
    expect(updated.search_radius_km).toBe(6);
    expect(updated.admin_whatsapp_numbers).toBe('+250780000001,+250780000002');
  });
});
