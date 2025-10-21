import type { Coordinates } from '../../_lib/locations';
import { parseGeography } from '../../_lib/locations';

export type FavoriteRow = {
  id: string;
  user_id: string;
  kind: string;
  label: string;
  geog: unknown;
};

export type MatchLocationResult = {
  pickup: Coordinates;
  dropoff: Coordinates | null;
  originFavorite: FavoriteRow | null;
  destinationFavorite: FavoriteRow | null;
};

export function buildMatchLocations(
  existingPickup: Coordinates | null,
  existingDropoff: Coordinates | null,
  originFavorite: FavoriteRow | null,
  destinationFavorite: FavoriteRow | null,
): MatchLocationResult | null {
  let pickup = existingPickup ?? null;
  let dropoff = existingDropoff ?? null;

  if (!pickup && originFavorite) {
    const coords = parseGeography(originFavorite.geog as any);
    if (!coords) return null;
    pickup = coords;
  }

  if (!pickup) {
    return null;
  }

  if (!dropoff && destinationFavorite) {
    dropoff = parseGeography(destinationFavorite.geog as any);
  }

  return {
    pickup,
    dropoff,
    originFavorite: originFavorite ?? null,
    destinationFavorite: destinationFavorite ?? null,
  };
}

export function shouldApplyDualConstraint(dropoff: Coordinates | null, dualConstraintEnabled: boolean): boolean {
  return Boolean(dropoff && dualConstraintEnabled);
}

export function normalizeRadius(radius: number | undefined, fallback = 10): number {
  if (typeof radius !== 'number' || Number.isNaN(radius)) {
    return fallback;
  }
  return Math.min(Math.max(radius, 0.5), 50);
}
