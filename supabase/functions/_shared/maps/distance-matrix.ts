/**
 * Google Maps Distance Matrix API Integration
 * Provides accurate distance and duration calculations with traffic
 */

export interface DistanceMatrixRequest {
  origins: Array<{ lat: number; lng: number }>;
  destinations: Array<{ lat: number; lng: number }>;
  mode?: "driving" | "walking" | "bicycling" | "transit";
  departureTime?: Date;
  trafficModel?: "best_guess" | "pessimistic" | "optimistic";
}

export interface DistanceMatrixResult {
  distance_meters: number;
  duration_seconds: number;
  duration_in_traffic_seconds?: number;
  status: "OK" | "ZERO_RESULTS" | "NOT_FOUND";
}

export interface DistanceMatrixResponse {
  results: DistanceMatrixResult[][];
  error?: string;
}

/**
 * Calculate distance and duration using Google Maps Distance Matrix API
 */
export async function calculateDistanceMatrix(
  apiKey: string,
  request: DistanceMatrixRequest
): Promise<DistanceMatrixResponse> {
  try {
    // Build origins parameter
    const origins = request.origins
      .map((o) => `${o.lat},${o.lng}`)
      .join("|");

    // Build destinations parameter
    const destinations = request.destinations
      .map((d) => `${d.lat},${d.lng}`)
      .join("|");

    // Build URL with parameters
    const params = new URLSearchParams({
      origins,
      destinations,
      mode: request.mode || "driving",
      key: apiKey,
    });

    // Add departure time for traffic-aware routing
    if (request.departureTime) {
      params.append("departure_time", Math.floor(request.departureTime.getTime() / 1000).toString());
      params.append("traffic_model", request.trafficModel || "best_guess");
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;

    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK") {
      return {
        results: [],
        error: `API status: ${data.status} - ${data.error_message || "Unknown error"}`,
      };
    }

    // Parse results
    const results: DistanceMatrixResult[][] = data.rows.map((row: any) =>
      row.elements.map((element: any) => {
        if (element.status !== "OK") {
          return {
            distance_meters: 0,
            duration_seconds: 0,
            status: element.status,
          };
        }

        return {
          distance_meters: element.distance.value,
          duration_seconds: element.duration.value,
          duration_in_traffic_seconds: element.duration_in_traffic?.value,
          status: "OK" as const,
        };
      })
    );

    return { results };
  } catch (error) {
    console.error("Distance Matrix API error:", error);
    return {
      results: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Calculate ETA for a single origin-destination pair
 */
export async function calculateETA(
  apiKey: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  options?: {
    mode?: "driving" | "walking" | "bicycling";
    includeTraffic?: boolean;
  }
): Promise<{
  distance_km: number;
  duration_minutes: number;
  duration_with_traffic_minutes?: number;
  error?: string;
}> {
  const request: DistanceMatrixRequest = {
    origins: [origin],
    destinations: [destination],
    mode: options?.mode || "driving",
  };

  // Include traffic data if requested
  if (options?.includeTraffic) {
    request.departureTime = new Date(); // Now
    request.trafficModel = "best_guess";
  }

  const response = await calculateDistanceMatrix(apiKey, request);

  if (response.error || !response.results[0]?.[0]) {
    return {
      distance_km: 0,
      duration_minutes: 0,
      error: response.error || "No results",
    };
  }

  const result = response.results[0][0];

  if (result.status !== "OK") {
    return {
      distance_km: 0,
      duration_minutes: 0,
      error: `Route not found: ${result.status}`,
    };
  }

  return {
    distance_km: result.distance_meters / 1000,
    duration_minutes: Math.ceil(result.duration_seconds / 60),
    duration_with_traffic_minutes: result.duration_in_traffic_seconds
      ? Math.ceil(result.duration_in_traffic_seconds / 60)
      : undefined,
  };
}

/**
 * Fallback: Calculate straight-line distance (Haversine formula)
 * Used when Google Maps API is unavailable
 */
export function calculateStraightLineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Estimate ETA from straight-line distance
 * Fallback when API is unavailable
 */
export function estimateETAFromDistance(
  distance_km: number,
  mode: "driving" | "walking" | "bicycling" = "driving"
): number {
  // Average speeds (km/h)
  const speeds = {
    driving: 30, // Urban driving with traffic
    walking: 5,
    bicycling: 15,
  };

  const speed = speeds[mode];
  return Math.ceil((distance_km / speed) * 60); // Convert to minutes
}

/**
 * Cache for distance matrix results
 */
const distanceCache = new Map<string, { result: DistanceMatrixResult; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCacheKey(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): string {
  return `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}-${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
}

/**
 * Calculate ETA with caching
 */
export async function calculateETAWithCache(
  apiKey: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  options?: {
    mode?: "driving" | "walking" | "bicycling";
    includeTraffic?: boolean;
  }
): Promise<{
  distance_km: number;
  duration_minutes: number;
  duration_with_traffic_minutes?: number;
  cached?: boolean;
  error?: string;
}> {
  const cacheKey = getCacheKey(origin, destination);
  const cached = distanceCache.get(cacheKey);

  // Return cached result if fresh
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      distance_km: cached.result.distance_meters / 1000,
      duration_minutes: Math.ceil(cached.result.duration_seconds / 60),
      duration_with_traffic_minutes: cached.result.duration_in_traffic_seconds
        ? Math.ceil(cached.result.duration_in_traffic_seconds / 60)
        : undefined,
      cached: true,
    };
  }

  // Calculate fresh result
  const result = await calculateETA(apiKey, origin, destination, options);

  // Cache successful results
  if (!result.error) {
    distanceCache.set(cacheKey, {
      result: {
        distance_meters: result.distance_km * 1000,
        duration_seconds: result.duration_minutes * 60,
        duration_in_traffic_seconds: result.duration_with_traffic_minutes
          ? result.duration_with_traffic_minutes * 60
          : undefined,
        status: "OK",
      },
      timestamp: Date.now(),
    });
  }

  return result;
}
