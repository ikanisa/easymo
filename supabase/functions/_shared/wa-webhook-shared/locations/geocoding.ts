/**
 * Reverse geocoding utilities
 * Uses Nominatim (OpenStreetMap) for free reverse geocoding
 * Falls back to coordinates if API fails
 */

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type GeocodingResult = {
  address: string;
  displayName: string;
  city?: string;
  country?: string;
  cached: boolean;
};

// Simple in-memory cache (consider Redis for production)
const geocodeCache = new Map<string, { result: GeocodingResult; timestamp: number }>();

/**
 * Reverse geocode coordinates to human-readable address
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 * 
 * Rate limit: 1 request per second
 * Usage Policy: https://operations.osmfoundation.org/policies/nominatim/
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  options: { useCache?: boolean; timeout?: number } = {},
): Promise<GeocodingResult | null> {
  const { useCache = true, timeout = 5000 } = options;
  
  // Round coordinates to 5 decimal places for cache key (~1m precision)
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  
  // Check cache
  if (useCache) {
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.result, cached: true };
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const url = new URL("/reverse", NOMINATIM_BASE_URL);
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lon", lng.toString());
    url.searchParams.set("zoom", "18"); // Building level
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "EasyMO/1.0 (mobility platform)", // Required by Nominatim
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("geocoding.nominatim_fail", {
        status: response.status,
        lat,
        lng,
      });
      return null;
    }

    const data = await response.json();
    
    if (!data || !data.display_name) {
      return null;
    }

    const result: GeocodingResult = {
      address: formatAddress(data.address),
      displayName: data.display_name,
      city: data.address?.city || data.address?.town || data.address?.village,
      country: data.address?.country,
      cached: false,
    };

    // Cache result
    geocodeCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("geocoding.timeout", { lat, lng });
    } else {
      console.error("geocoding.error", error, { lat, lng });
    }
    return null;
  }
}

/**
 * Format Nominatim address into concise human-readable format
 */
function formatAddress(address: Record<string, string>): string {
  const parts: string[] = [];

  // Add street info
  if (address.road) {
    if (address.house_number) {
      parts.push(`${address.house_number} ${address.road}`);
    } else {
      parts.push(address.road);
    }
  } else if (address.neighbourhood) {
    parts.push(address.neighbourhood);
  }

  // Add city/town
  const locality = address.city || address.town || address.village || address.suburb;
  if (locality) {
    parts.push(locality);
  }

  // Add country if international
  if (address.country && address.country !== "Rwanda") {
    parts.push(address.country);
  }

  return parts.join(", ") || "Unknown Location";
}

/**
 * Get formatted address or fallback to coordinates
 */
export async function getAddressOrCoords(
  lat: number,
  lng: number,
): Promise<string> {
  const result = await reverseGeocode(lat, lng);
  
  if (result?.address) {
    return result.address;
  }
  
  // Fallback to coordinates
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Clear geocoding cache (useful for testing)
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}

/**
 * Get cache stats (for monitoring)
 */
export function getGeocodeStats(): { size: number; oldestEntry: number | null } {
  let oldest: number | null = null;
  const now = Date.now();
  
  for (const entry of geocodeCache.values()) {
    const age = now - entry.timestamp;
    if (oldest === null || age > oldest) {
      oldest = age;
    }
  }
  
  return {
    size: geocodeCache.size,
    oldestEntry: oldest,
  };
}
