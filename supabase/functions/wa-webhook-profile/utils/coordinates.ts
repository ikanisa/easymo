/**
 * Coordinate Parsing Utilities
 *
 * Provides utilities for parsing and validating location coordinates
 * from WhatsApp location messages.
 */

/**
 * Coerce location coordinates to numbers and validate
 *
 * @param lat - Latitude (string or number)
 * @param lng - Longitude (string or number)
 * @returns Parsed coordinates or null if invalid
 */
export function parseCoordinates(
  lat: unknown,
  lng: unknown,
): { lat: number; lng: number } | null {
  let parsedLat: number;
  let parsedLng: number;

  if (typeof lat === "string") {
    parsedLat = parseFloat(lat);
  } else if (typeof lat === "number") {
    parsedLat = lat;
  } else {
    return null;
  }

  if (typeof lng === "string") {
    parsedLng = parseFloat(lng);
  } else if (typeof lng === "number") {
    parsedLng = lng;
  } else {
    return null;
  }

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return null;
  }

  // Validate coordinate ranges
  if (
    parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180
  ) {
    return null;
  }

  return { lat: parsedLat, lng: parsedLng };
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(
  lat: number,
  lng: number,
  precision = 4,
): string {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}
