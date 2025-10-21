import { describe, expect, it } from 'vitest';
import { describe, expect, it } from 'vitest';
import { buildMatchLocations, normalizeRadius, shouldApplyDualConstraint } from '../../app/api/match/search/helpers';

describe('match search helpers', () => {
  it('uses favorite location when pickup missing', () => {
    const result = buildMatchLocations(
      null,
      null,
      {
        id: 'c1',
        user_id: 'u1',
        kind: 'home',
        label: 'Home',
        geog: 'POINT(30.061 -1.9445)',
      },
      null,
    );

    expect(result).not.toBeNull();
    expect(result?.pickup).toEqual({ lat: -1.9445, lng: 30.061 });
  });

  it('enables dual constraint when dropoff from favorite present', () => {
    const result = buildMatchLocations(
      { lat: -1.94, lng: 30.06 },
      null,
      null,
      {
        id: 'c2',
        user_id: 'u1',
        kind: 'work',
        label: 'Work',
        geog: 'POINT(30.07 -1.95)',
      },
    );

    expect(result).not.toBeNull();
    expect(result?.dropoff).toEqual({ lat: -1.95, lng: 30.07 });
    expect(shouldApplyDualConstraint(result?.dropoff ?? null, true)).toBe(true);
  });

  it('normalizes radius to allowed bounds', () => {
    expect(normalizeRadius(undefined, 10)).toBe(10);
    expect(normalizeRadius(0.1, 10)).toBeCloseTo(0.5);
    expect(normalizeRadius(200, 10)).toBe(50);
  });
});
