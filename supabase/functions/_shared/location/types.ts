/**
 * Unified Location Service Types
 * 
 * FULLY DYNAMIC - No hardcoded source enums!
 * Any service/agent can define its own config without code changes.
 * 
 * @module location/types
 */

/**
 * Location request configuration - FULLY DYNAMIC
 * Any service/agent can define its own config without code changes
 */
export interface LocationConfig {
  /** Identifier for the requesting service (any string - NOT an enum) */
  source: string;
  
  /** Cache TTL in minutes (default: 30) */
  cacheTTLMinutes?: number;
  
  /** Preferred saved location label to check first */
  preferredSavedLabel?: 'home' | 'work' | 'school' | string;
  
  /** Whether to auto-use valid cache (default: true) */
  autoUseCache?: boolean;
  
  /** Custom prompt message (overrides default) */
  customPrompt?: string;
  
  /** Context for logging/analytics */
  context?: Record<string, unknown>;
  
  /** Search radius in meters (for nearby queries) */
  searchRadiusMeters?: number;
  
  /** Whether location is required (default: false) */
  required?: boolean;
}

/**
 * Result of location resolution
 */
export interface LocationResult {
  /** Resolved coordinates */
  location: { lat: number; lng: number } | null;
  
  /** Whether user needs to share location */
  needsPrompt: boolean;
  
  /** Source of the location */
  source: 'cache' | 'saved' | 'shared' | 'fallback' | null;
  
  /** Age in minutes (if from cache) */
  ageMinutes?: number;
  
  /** Label (if from saved location) */
  label?: string;
  
  /** Prompt details (if needsPrompt is true) */
  prompt?: {
    message: string;
    buttons: Array<{ id: string; title: string }>;
    hasRecentLocation: boolean;
  };
}

/**
 * Result of nearby search
 */
export interface NearbyResult<T = unknown> {
  items: T[];
  searchCenter: { lat: number; lng: number };
  radiusMeters: number;
  totalFound: number;
}

/**
 * Saved location (favorite)
 */
export interface SavedLocation {
  id: string;
  user_id: string;
  label: string;
  lat: number;
  lng: number;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Recent/cached location
 */
export interface RecentLocation {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  address?: string | null;
  source: string;
  context?: string | null;
  expires_at: string;
  captured_at: string;
}

/**
 * Multi-language support
 */
export type Locale = 'en' | 'fr' | 'rw';
