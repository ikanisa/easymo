import { describe, expect, it, vi } from 'vitest';

import { saveVendorLead } from '../../src/tools/saveVendorLead';

vi.mock('@supabase/supabase-js', () => {
  const upsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'lead-1' }, error: null }),
    }),
  });
  return {
    createClient: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        upsert,
      }),
    }),
  };
});

vi.mock('../../src/audit/writeAuditEvent', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

const originalEnv = { ...process.env };

describe('saveVendorLead', () => {
  it('upserts vendor lead and writes audit event', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    const result = await saveVendorLead({
      request_id: 'req-1',
      source: 'external_discovery',
      dedupe_key: 'abc',
      candidate: {
        name: 'Vendor A',
        phones: ['+250788000111'],
        website: 'https://vendor-a.example.com',
        confidence: 0.5,
        sources: [],
      },
    });

    expect(result?.id).toBe('lead-1');

    process.env = { ...originalEnv };
  });
});
