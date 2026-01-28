import { describe, expect, it } from 'vitest';

import { buildDedupeKey } from '../../src/discovery/dedupeKey';

describe('buildDedupeKey', () => {
  it('produces stable hash for same inputs', () => {
    const key1 = buildDedupeKey({
      name: 'Vendor One',
      phones: ['+250788000111'],
      website: 'https://vendor.example.com',
    });
    const key2 = buildDedupeKey({
      name: 'Vendor One',
      phones: ['+250788000111'],
      website: 'https://vendor.example.com',
    });
    expect(key1).toBe(key2);
  });

  it('normalizes phone numbers and website', () => {
    const key1 = buildDedupeKey({
      name: 'Vendor One',
      phones: ['+250 788 000 111'],
      website: 'HTTPS://VENDOR.EXAMPLE.COM/',
    });
    const key2 = buildDedupeKey({
      name: 'Vendor One',
      phones: ['+250788000111'],
      website: 'https://vendor.example.com/',
    });
    expect(key1).toBe(key2);
  });
});
