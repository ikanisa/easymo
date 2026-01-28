import { describe, expect, it } from 'vitest';

import { formatExternalOptionsForClient } from '../../src/tools/formatExternalOptionsForClient';

describe('formatExternalOptionsForClient', () => {
  it('returns empty string when no candidates', () => {
    expect(formatExternalOptionsForClient({ candidates: [] })).toBe('');
  });

  it('formats candidates with safe template', () => {
    const message = formatExternalOptionsForClient({
      candidates: [
        {
          name: 'Vendor A',
          phones: ['+250788000111'],
          website: 'https://vendor-a.example.com',
          confidence: 0.5,
          sources: [],
        },
      ],
    });

    expect(message).toContain('Vendor A');
    expect(message).toContain('+250788000111');
    expect(message).toContain('vendor-a.example.com');
  });
});
