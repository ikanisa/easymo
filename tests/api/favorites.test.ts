import { describe, expect, it } from 'vitest';
import { buildFavoriteInsert, needsUnsetDefault } from '../../app/api/favorites/utils';

describe('favorite helpers', () => {
  it('buildFavoriteInsert converts coordinates to geography point', () => {
    const payload = {
      kind: 'home' as const,
      label: 'Home',
      lat: -1.9445,
      lng: 30.061,
    };

    const insert = buildFavoriteInsert('f0d94521-0f5c-45e5-91ec-260ff927b64a', payload);
    expect(insert.geog).toMatch(/^SRID=4326;POINT\([0-9.-]+ [0-9.-]+\)$/);
    expect(insert.is_default).toBe(false);
  });

  it('needsUnsetDefault detects when default flag set', () => {
    const payload = {
      id: '2e8f4d45-7c4d-4a57-bb59-66aa6cf68bb6',
      is_default: true,
    } as const;
    expect(needsUnsetDefault(payload)).toBe(true);
  });
});
