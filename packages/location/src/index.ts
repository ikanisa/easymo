/**
 * @easymo/location - Centralized Location Service
 * 
 * SINGLE SOURCE OF TRUTH for all location-related operations across EasyMO platform.
 * 
 * This package must be used by:
 * - All microservices (NestJS)
 * - All edge functions (Supabase/Deno)
 * - All frontend apps (React/Next.js)
 * - All AI agents (Node.js/Deno)
 * 
 * NO hardcoded location logic anywhere else!
 */

// ============================================================================
// LOCATION CONFIGURATION - SINGLE SOURCE OF TRUTH
// ============================================================================

export const LOCATION_CONFIG = {
  // Search Radius (meters)
  DEFAULT_SEARCH_RADIUS_METERS: 15000, // 15km - default for all domains
  
  // Domain-specific radius overrides
  MOBILITY_RADIUS_METERS: 10000,      // 10km - mobility (rides)
  JOBS_RADIUS_METERS: 50000,          // 50km - jobs (wider search)
  REAL_ESTATE_RADIUS_METERS: 10000,   // 10km - real estate
  MARKETPLACE_RADIUS_METERS: 5000,    // 5km - marketplace/businesses
  
  // Location freshness thresholds (minutes)
  FRESH_LOCATION_THRESHOLD_MINUTES: 60,    // Location considered fresh
  STALE_LOCATION_THRESHOLD_MINUTES: 120,   // Location considered stale
  
  // Cache TTL (minutes)
  CACHE_TTL_MINUTES: 60,                    // Default cache TTL
  
  // Domain-specific cache TTL (hours)
  MOBILITY_CACHE_TTL_HOURS: 2,              // Driver/passenger locations
  JOBS_CACHE_TTL_HOURS: 168,                // 7 days - job searches
  REAL_ESTATE_CACHE_TTL_HOURS: 168,         // 7 days - property searches
  MARKETPLACE_CACHE_TTL_HOURS: 24,          // 1 day - business searches
  GENERAL_CACHE_TTL_HOURS: 24,              // Default
  
  // Coordinate validation
  LATITUDE_MIN: -90,
  LATITUDE_MAX: 90,
  LONGITUDE_MIN: -180,
  LONGITUDE_MAX: 180,
  
  // Trip/Match configuration
  TRIP_EXPIRY_MINUTES: 90,                  // Trip request expiration
  MAX_MATCHES_TO_RETURN: 20,                // Max matching results
  MIN_MATCH_SCORE: 20,                      // Minimum match score threshold
  
  // Location tracking
  MAX_LOCATION_AGE_MS: 5 * 60 * 1000,      // 5 minutes for real-time tracking
  
  // Distance matrix API
  DISTANCE_MATRIX_TIMEOUT_MS: 10000,        // 10 seconds
  MAX_DISTANCE_METERS: 50000,               // 50km max for distance calculations
} as const;

// ============================================================================
// DOMAIN CONTEXTS
// ============================================================================

export type LocationContext = 
  | 'mobility' 
  | 'jobs' 
  | 'real_estate' 
  | 'marketplace' 
  | 'general';

export type LocationSource =
  | 'user_input'
  | 'gps'
  | 'map_pin'
  | 'whatsapp'
  | 'imported'
  | 'geocoded';

// ============================================================================
// LOCATION TYPES
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
  latitude?: number;  // Alias for compatibility
  longitude?: number; // Alias for compatibility
}

export interface Location extends Coordinates {
  address?: string;
}

export interface CachedLocation extends Location {
  source: LocationSource;
  context: LocationContext;
  cached_at: Date;
  expires_at: Date;
  age_minutes: number;
}

export interface ProximitySearchParams {
  lat: number;
  lng: number;
  radiusKm?: number;
  radiusMeters?: number;
  limit?: number;
  context?: LocationContext;
}

export interface ProximityResult<T = any> {
  item: T;
  distance_km: number;
  distance_meters: number;
}

// ============================================================================
// LOCATION VALIDATION
// ============================================================================

export class LocationValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message);
    this.name = 'LocationValidationError';
  }
}

/**
 * Validates and normalizes coordinates
 * Throws LocationValidationError if invalid
 */
export function validateCoordinates(coords: Partial<Coordinates>): Coordinates {
  // Normalize field names
  const lat = coords.lat ?? coords.latitude;
  const lng = coords.lng ?? coords.longitude;
  
  if (lat === undefined || lng === undefined) {
    throw new LocationValidationError(
      'Missing coordinates',
      'coordinates',
      coords
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
      `Latitude ${lat} out of range [${LOCATION_CONFIG.LATITUDE_MIN}, ${LOCATION_CONFIG.LATITUDE_MAX}]`,
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
      `Longitude ${lng} out of range [${LOCATION_CONFIG.LONGITUDE_MIN}, ${LOCATION_CONFIG.LONGITUDE_MAX}]`,
      'longitude',
      lng
    );
  }
  
  return { lat, lng };
}

/**
 * Normalizes different coordinate formats to standard { lat, lng }
 */
export function normalizeLocation(location: any): Coordinates {
  if (!location) {
    throw new LocationValidationError('Location is null or undefined', 'location', location);
  }
  
  // Handle different formats
  const lat = location.lat ?? location.latitude ?? location.y;
  const lng = location.lng ?? location.longitude ?? location.lon ?? location.x;
  
  return validateCoordinates({ lat, lng });
}

// ============================================================================
// DOMAIN CONFIGURATION HELPERS
// ============================================================================

/**
 * Get domain-specific search radius
 */
export function getSearchRadius(context: LocationContext): number {
  switch (context) {
    case 'mobility':
      return LOCATION_CONFIG.MOBILITY_RADIUS_METERS;
    case 'jobs':
      return LOCATION_CONFIG.JOBS_RADIUS_METERS;
    case 'real_estate':
      return LOCATION_CONFIG.REAL_ESTATE_RADIUS_METERS;
    case 'marketplace':
      return LOCATION_CONFIG.MARKETPLACE_RADIUS_METERS;
    default:
      return LOCATION_CONFIG.DEFAULT_SEARCH_RADIUS_METERS;
  }
}

/**
 * Get domain-specific cache TTL (hours)
 */
export function getCacheTTL(context: LocationContext): number {
  switch (context) {
    case 'mobility':
      return LOCATION_CONFIG.MOBILITY_CACHE_TTL_HOURS;
    case 'jobs':
      return LOCATION_CONFIG.JOBS_CACHE_TTL_HOURS;
    case 'real_estate':
      return LOCATION_CONFIG.REAL_ESTATE_CACHE_TTL_HOURS;
    case 'marketplace':
      return LOCATION_CONFIG.MARKETPLACE_CACHE_TTL_HOURS;
    default:
      return LOCATION_CONFIG.GENERAL_CACHE_TTL_HOURS;
  }
}

/**
 * Convert radius to meters (handles both km and m)
 */
export function normalizeRadius(params: { radiusKm?: number; radiusMeters?: number }): number {
  if (params.radiusMeters) {
    return params.radiusMeters;
  }
  if (params.radiusKm) {
    return params.radiusKm * 1000;
  }
  return LOCATION_CONFIG.DEFAULT_SEARCH_RADIUS_METERS;
}

/**
 * Check if location is fresh
 */
export function isLocationFresh(timestamp: Date | string, thresholdMinutes?: number): boolean {
  const threshold = thresholdMinutes ?? LOCATION_CONFIG.FRESH_LOCATION_THRESHOLD_MINUTES;
  const locationTime = new Date(timestamp);
  const now = new Date();
  const ageMinutes = (now.getTime() - locationTime.getTime()) / (1000 * 60);
  return ageMinutes <= threshold;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(from: Coordinates, to: Coordinates): number {
  const fromValid = validateCoordinates(from);
  const toValid = validateCoordinates(to);
  
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(toValid.lat - fromValid.lat);
  const dLng = toRadians(toValid.lng - fromValid.lng);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromValid.lat)) *
      Math.cos(toRadians(toValid.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

/**
 * Check if point is within radius
 */
export function isWithinRadius(
  center: Coordinates,
  point: Coordinates,
  radiusKm: number
): boolean {
  const distance = calculateDistance(center, point);
  return distance <= radiusKm;
}

/**
 * Create PostGIS geography point SQL
 */
export function makePostGISPoint(coords: Coordinates): string {
  const validated = validateCoordinates(coords);
  // PostGIS uses POINT(longitude latitude) order
  return `ST_SetSRID(ST_MakePoint(${validated.lng}, ${validated.lat}), 4326)::geography`;
}

/**
 * Get location cache key
 */
export function getLocationCacheKey(userId: string, context: LocationContext = 'general'): string {
  return `location:${context}:${userId}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const LocationUtils = {
  validateCoordinates,
  normalizeLocation,
  getSearchRadius,
  getCacheTTL,
  normalizeRadius,
  isLocationFresh,
  calculateDistance,
  formatDistance,
  isWithinRadius,
  makePostGISPoint,
  getLocationCacheKey,
  config: LOCATION_CONFIG,
};

export default LocationUtils;
