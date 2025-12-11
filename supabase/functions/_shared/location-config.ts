/**
 * Location Services Configuration - SINGLE SOURCE OF TRUTH
 * Addresses Issues #4, #14 from location services investigation
 * 
 * This file standardizes all location-related configuration across the platform
 */

// ============================================================================
// CORE LOCATION CONSTANTS
// ============================================================================

export const LOCATION_CONFIG = {
  // Search radius (meters) - SINGLE SOURCE OF TRUTH
  DEFAULT_SEARCH_RADIUS_METERS: 15000, // 15km
  
  // Location freshness thresholds (minutes)
  FRESH_LOCATION_THRESHOLD_MINUTES: 60,  // Changed from 30 to 60
  STALE_LOCATION_THRESHOLD_MINUTES: 120,
  
  // Cache TTL
  CACHE_TTL_MINUTES: 60, // Changed from 30 to 60
  
  // Coordinate validation
  LATITUDE_MIN: -90,
  LATITUDE_MAX: 90,
  LONGITUDE_MIN: -180,
  LONGITUDE_MAX: 180,
  
  // Trip expiration
  TRIP_EXPIRY_MINUTES: 90,
  
  // Matching limits
  MAX_MATCHES_TO_RETURN: 20,
  MIN_MATCH_SCORE: 20,
} as const;

// ============================================================================
// LOCATION VALIDATION
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
  latitude?: number; // Alias for compatibility
  longitude?: number; // Alias for compatibility
}

export class LocationValidationError extends Error {
  constructor(message: string, public field: string, public value: number) {
    super(message);
    this.name = 'LocationValidationError';
  }
}

/**
 * Validates and normalizes coordinates
 * Addresses Issue #15: No Location Validation
 */
export function validateCoordinates(coords: Partial<Coordinates>): Coordinates {
  // Normalize field names (handle both lat/lng and latitude/longitude)
  const lat = coords.lat ?? coords.latitude;
  const lng = coords.lng ?? coords.longitude;
  
  if (lat === undefined || lng === undefined) {
    throw new LocationValidationError(
      'Missing coordinates',
      'coordinates',
      0
    );
  }
  
  // Validate latitude
  if (typeof lat !== 'number' || isNaN(lat)) {
    throw new LocationValidationError(
      `Invalid latitude: ${lat}. Must be a number.`,
      'latitude',
      lat
    );
  }
  
  if (lat < LOCATION_CONFIG.LATITUDE_MIN || lat > LOCATION_CONFIG.LATITUDE_MAX) {
    throw new LocationValidationError(
      `Latitude ${lat} out of range. Must be between ${LOCATION_CONFIG.LATITUDE_MIN} and ${LOCATION_CONFIG.LATITUDE_MAX}.`,
      'latitude',
      lat
    );
  }
  
  // Validate longitude
  if (typeof lng !== 'number' || isNaN(lng)) {
    throw new LocationValidationError(
      `Invalid longitude: ${lng}. Must be a number.`,
      'longitude',
      lng
    );
  }
  
  if (lng < LOCATION_CONFIG.LONGITUDE_MIN || lng > LOCATION_CONFIG.LONGITUDE_MAX) {
    throw new LocationValidationError(
      `Longitude ${lng} out of range. Must be between ${LOCATION_CONFIG.LONGITUDE_MIN} and ${LOCATION_CONFIG.LONGITUDE_MAX}.`,
      'longitude',
      lng
    );
  }
  
  return { lat, lng };
}

// ============================================================================
// POSTGIS HELPERS
// ============================================================================

/**
 * Creates PostGIS geography from coordinates
 * Addresses Issue #21: Coordinate order (lng, lat for PostGIS)
 */
export function makePostGISPoint(coords: Coordinates): string {
  const validated = validateCoordinates(coords);
  // PostGIS uses POINT(longitude latitude) order
  return `ST_SetSRID(ST_MakePoint(${validated.lng}, ${validated.lat}), 4326)::geography`;
}

/**
 * Checks if location is fresh based on timestamp
 * Addresses Issue #3: Location Freshness Too Strict
 */
export function isLocationFresh(timestamp: Date | string, thresholdMinutes?: number): boolean {
  const threshold = thresholdMinutes ?? LOCATION_CONFIG.FRESH_LOCATION_THRESHOLD_MINUTES;
  const locationTime = new Date(timestamp);
  const now = new Date();
  const ageMinutes = (now.getTime() - locationTime.getTime()) / (1000 * 60);
  return ageMinutes <= threshold;
}

// ============================================================================
// LOCATION CACHE KEY STANDARDIZATION
// ============================================================================

/**
 * Standardizes cache key generation
 * Addresses Issue #7: Location Cache Not Integrated Everywhere
 */
export function getLocationCacheKey(userId: string, context: string = 'mobility'): string {
  return `location:${context}:${userId}`;
}

// ============================================================================
// COORDINATE NORMALIZATION
// ============================================================================

/**
 * Normalizes different coordinate formats to standard { lat, lng }
 * Addresses Issue #12: Multiple Location Type Definitions
 */
export function normalizeLocation(location: any): Coordinates {
  if (!location) {
    throw new LocationValidationError('Location is null or undefined', 'location', 0);
  }
  
  // Handle different formats
  const lat = location.lat ?? location.latitude ?? location.y;
  const lng = location.lng ?? location.longitude ?? location.lon ?? location.x;
  
  return validateCoordinates({ lat, lng });
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

// ============================================================================
// LOCATION CACHE HELPERS
// ============================================================================

export interface CachedLocation {
  lat: number;
  lng: number;
  address?: string;
  source: string;
  cached_at: Date;
  age_minutes: number;
}

/**
 * Cache a user's location for future use
 * Addresses Issue #7: Location Cache Not Integrated Everywhere
 */
export async function cacheUserLocation(
  supabaseClient: any,
  userId: string,
  coords: Coordinates,
  options?: {
    address?: string;
    source?: string;
    context?: string;
    ttlHours?: number;
  }
): Promise<string> {
  const validated = validateCoordinates(coords);
  
  const { data, error } = await supabaseClient.rpc('cache_user_location', {
    p_user_id: userId,
    p_lat: validated.lat,
    p_lng: validated.lng,
    p_address: options?.address ?? null,
    p_source: options?.source ?? 'user_input',
    p_context: options?.context ?? 'general',
    p_ttl_hours: options?.ttlHours ?? 24,
  });
  
  if (error) throw error;
  return data;
}

/**
 * Get user's most recent cached location
 * Addresses Issue #7: Location Cache Not Integrated Everywhere
 */
export async function getRecentLocation(
  supabaseClient: any,
  userId: string,
  context: string = 'general',
  maxAgeMinutes: number = 60
): Promise<CachedLocation | null> {
  const { data, error } = await supabaseClient.rpc('get_recent_location', {
    p_user_id: userId,
    p_context: context,
    p_max_age_minutes: maxAgeMinutes,
  });
  
  if (error) throw error;
  if (!data || data.length === 0) return null;
  
  return {
    lat: data[0].lat,
    lng: data[0].lng,
    address: data[0].address,
    source: data[0].source,
    cached_at: new Date(data[0].cached_at),
    age_minutes: data[0].age_minutes,
  };
}

// ============================================================================
// PROXIMITY SEARCH HELPER
// ============================================================================

export interface ProximitySearchOptions {
  tableName: string;
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
  whereClause?: string;
}

/**
 * Universal proximity search - works with any table
 */
export async function findNearbyItems(
  supabaseClient: any,
  options: ProximitySearchOptions
): Promise<Array<{ item_data: any; distance_km: number }>> {
  const coords = validateCoordinates({ lat: options.lat, lng: options.lng });
  
  const { data, error } = await supabaseClient.rpc('find_nearby_items', {
    p_table_name: options.tableName,
    p_lat: coords.lat,
    p_lng: coords.lng,
    p_radius_km: options.radiusKm ?? 10,
    p_limit: options.limit ?? 20,
    p_where_clause: options.whereClause ?? null,
  });
  
  if (error) throw error;
  return data ?? [];
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export const LocationUtils = {
  validateCoordinates,
  makePostGISPoint,
  isLocationFresh,
  getLocationCacheKey,
  normalizeLocation,
  cacheUserLocation,
  getRecentLocation,
  findNearbyItems,
  config: LOCATION_CONFIG,
};

export default LocationUtils;
