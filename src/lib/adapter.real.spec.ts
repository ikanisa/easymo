import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock the Supabase client.  We only mock the parts of supabase that are
// exercised by the tests.  Vitest allows us to intercept imports and
// replace them with our own implementation.
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => {
      return {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn(() => ({ maybeSingle: vi.fn(() => ({ data: { subscription_price: 5000, search_radius_km: 5, max_results: 10, momo_payee_number: '0780000000', support_phone_e164: '+250780000000' }, error: null }) })) })) }),
          update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn(() => ({ data: { subscription_price: 6000, search_radius_km: 6, max_results: 8, momo_payee_number: '0781111111', support_phone_e164: '+250780001111' }, error: null }) })) })) })) }),
        });
      };
    }),
  };
});

// We import after mocking supabase so that RealAdapter picks up the mocked version
import { RealAdapter } from './adapter.real';

describe('RealAdapter', () => {
  beforeAll(() => {
    // Provide fake environment variables
    (globalThis as any).import_meta = { env: { VITE_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' } };
  });

  it('should fetch settings', async () => {
    const adapter = new RealAdapter();
    const settings = await adapter.getSettings();
    expect(settings.subscription_price).toBe(5000);
    expect(settings.search_radius_km).toBe(5);
  });

  it('should update settings', async () => {
    const adapter = new RealAdapter();
    const updated = await adapter.updateSettings({ subscription_price: 6000 });
    expect(updated.subscription_price).toBe(6000);
    expect(updated.search_radius_km).toBe(6);
  });
});