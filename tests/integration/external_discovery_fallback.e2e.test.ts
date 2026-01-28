import { beforeEach, describe, expect, it, vi } from 'vitest';

const webDiscoverVendors = vi.fn();
const mapsDiscoverPlaces = vi.fn();
const enrichVendorCandidate = vi.fn();
const saveVendorLead = vi.fn();
const formatExternalOptionsForClient = vi.fn();

vi.mock('../../src/tools/webDiscoverVendors', () => ({ webDiscoverVendors }));
vi.mock('../../src/tools/mapsDiscoverPlaces', () => ({ mapsDiscoverPlaces }));
vi.mock('../../src/tools/enrichVendorCandidate', () => ({ enrichVendorCandidate }));
vi.mock('../../src/tools/saveVendorLead', () => ({ saveVendorLead }));
vi.mock('../../src/tools/formatExternalOptionsForClient', () => ({ formatExternalOptionsForClient }));

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv, EXTERNAL_DISCOVERY_ENABLED: 'true' };
  vi.resetModules();
  webDiscoverVendors.mockReset();
  mapsDiscoverPlaces.mockReset();
  enrichVendorCandidate.mockReset();
  saveVendorLead.mockReset();
  formatExternalOptionsForClient.mockReset();
});

describe('external discovery fallback', () => {
  it('returns external options when candidates are insufficient', async () => {
    const candidate = {
      name: 'Vendor A',
      phones: ['+250788000111'],
      website: 'https://vendor-a.example.com',
      confidence: 0.5,
      sources: [],
    };

    webDiscoverVendors.mockResolvedValue({ candidates: [candidate] });
    mapsDiscoverPlaces.mockResolvedValue({ candidates: [] });
    enrichVendorCandidate.mockResolvedValue({ kind: 'lead', dedupe_key: 'abc', normalized: candidate });
    saveVendorLead.mockResolvedValue({ id: 'lead-1' });
    formatExternalOptionsForClient.mockReturnValue('External options message');

    const { runExternalDiscoveryFallback } = await import('../../src/orchestrator/externalDiscoveryFallback');

    const result = await runExternalDiscoveryFallback(
      {
        request_id: 'req-1',
        need: 'phone case',
        location_text: 'Kigali',
        language: 'en',
      },
      0,
    );

    expect(result.ran).toBe(true);
    expect(result.message).toContain('External options message');
    expect(result.lead_ids).toEqual(['lead-1']);
  });
});
