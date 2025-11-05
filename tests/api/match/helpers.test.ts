import { describe, expect, it } from 'vitest';
import {
  buildMatchLocations,
  normalizeRadius,
  shouldApplyDualConstraint,
  type FavoriteRow,
} from '../../../app/api/match/search/helpers';

const pickupFavorite: FavoriteRow = {
  id: 'fav_pickup',
  user_id: 'user',
  kind: 'pickup',
  label: 'Office',
  geog: 'SRID=4326;POINT(30.123 -1.234)',
};

const dropoffFavorite: FavoriteRow = {
  id: 'fav_dropoff',
  user_id: 'user',
  kind: 'dropoff',
  label: 'Home',
  geog: { type: 'Point', coordinates: [30.2, -1.3] },
};

describe('match helpers', () => {
  it('uses favorites as fallbacks when direct coordinates are missing', () => {
    const result = buildMatchLocations(null, null, pickupFavorite, dropoffFavorite);
    expect(result).not.toBeNull();
    expect(result?.pickup).toEqual({ lat: -1.234, lng: 30.123 });
    expect(result?.dropoff).toEqual({ lat: -1.3, lng: 30.2 });
  });

  it('returns null when pickup cannot be derived', () => {
    const invalidFavorite = { ...pickupFavorite, geog: 'invalid' };
    const result = buildMatchLocations(null, null, invalidFavorite, dropoffFavorite);
    expect(result).toBeNull();
  });

  it('prefers existing coordinates over favorites', () => {
    const result = buildMatchLocations(
      { lat: -1.0, lng: 30.0 },
      { lat: -1.5, lng: 30.5 },
      pickupFavorite,
      dropoffFavorite,
    );
    expect(result?.pickup).toEqual({ lat: -1.0, lng: 30.0 });
    expect(result?.dropoff).toEqual({ lat: -1.5, lng: 30.5 });
  });

  it('evaluates dual constraint flag based on drop-off presence', () => {
    expect(shouldApplyDualConstraint({ lat: -1, lng: 30 }, true)).toBe(true);
    expect(shouldApplyDualConstraint(null, true)).toBe(false);
    expect(shouldApplyDualConstraint({ lat: -1, lng: 30 }, false)).toBe(false);
  });

  it('normalizes search radius with sane bounds', () => {
    expect(normalizeRadius(undefined)).toBe(10);
    expect(normalizeRadius(Number.NaN)).toBe(10);
    expect(normalizeRadius(0.1)).toBeCloseTo(0.5);
    expect(normalizeRadius(100)).toBe(50);
    expect(normalizeRadius(7)).toBe(7);
  });
});
