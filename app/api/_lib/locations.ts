export type Coordinates = { lat: number; lng: number };

type GeographyInput =
  | { type?: string; coordinates?: [number, number] }
  | string
  | null
  | undefined;

export function toGeographyPoint(lng: number, lat: number): string {
  const safeLng = Number.isFinite(lng) ? Number(lng) : 0;
  const safeLat = Number.isFinite(lat) ? Number(lat) : 0;
  const normalizedLng = Math.round(safeLng * 1_000_000) / 1_000_000;
  const normalizedLat = Math.round(safeLat * 1_000_000) / 1_000_000;
  return `SRID=4326;POINT(${normalizedLng} ${normalizedLat})`;
}

export function parseGeography(value: GeographyInput): Coordinates | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const match = value.match(/POINT\(([-0-9.]+) ([-0-9.]+)\)/i);
    if (match) {
      const [, lngRaw, latRaw] = match;
      const lng = Number(lngRaw);
      const lat = Number(latRaw);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return { lat, lng };
      }
    }
    try {
      const json = JSON.parse(value);
      if (
        json &&
        typeof json === 'object' &&
        'coordinates' in json &&
        Array.isArray((json as any).coordinates) &&
        (json as any).coordinates.length === 2
      ) {
        const [lng, lat] = (json as any).coordinates;
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          return { lat, lng };
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length === 2
  ) {
    const [lng, lat] = value.coordinates;
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { lat, lng };
    }
  }

  return null;
}
