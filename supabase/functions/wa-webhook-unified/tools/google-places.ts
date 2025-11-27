/**
 * Google Places API Integration Tool
 * 
 * Provides real-time business search using Google Places API.
 * Features:
 * - Text search (find businesses by query)
 * - Nearby search (find businesses near coordinates)
 * - Place details (get full business information)
 * - Caching to reduce API costs
 * - Fallback to local database
 * 
 * Usage:
 * const placesTool = new GooglePlacesTool();
 * const results = await placesTool.searchNearby({ lat, lng, radius, keyword });
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// TYPES
// =====================================================

export interface PlaceSearchParams {
  lat: number;
  lng: number;
  radius: number; // in meters (max 50000)
  type?: string; // e.g., 'restaurant', 'pharmacy', 'store'
  keyword?: string;
}

export interface TextSearchParams {
  query: string;
  location?: string; // e.g., "Kigali, Rwanda"
  radius?: number; // in meters
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  review_count?: number;
  category?: string;
  phone?: string;
  website?: string;
  opening_hours?: any;
  price_level?: number;
  photos?: string[];
  source: "google_places";
  distance_km?: number;
}

export interface PlaceDetails extends PlaceResult {
  formatted_phone_number?: string;
  international_phone_number?: string;
  opening_hours_text?: string[];
  reviews?: Array<{
    author: string;
    rating: number;
    text: string;
    time: string;
  }>;
  photos_urls?: string[];
}

// =====================================================
// GOOGLE PLACES API TOOL
// =====================================================

export class GooglePlacesTool {
  private apiKey: string;
  private supabase: SupabaseClient;
  private baseUrl = "https://maps.googleapis.com/maps/api/place";
  private cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(supabase: SupabaseClient) {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      console.warn("GOOGLE_MAPS_API_KEY not set - Google Places search disabled");
      this.apiKey = "";
    } else {
      this.apiKey = apiKey;
    }
    this.supabase = supabase;
  }

  /**
   * Check if API is available
   */
  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Search for nearby places
   */
  async searchNearby(params: PlaceSearchParams): Promise<PlaceResult[]> {
    if (!this.isAvailable()) {
      console.warn("Google Places API not available - using fallback");
      return [];
    }

    try {
      // Check cache first
      const cacheKey = this.getCacheKey("nearby", params);
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        console.log("Google Places cache hit");
        return cached;
      }

      // Build API URL
      const url = new URL(`${this.baseUrl}/nearbysearch/json`);
      url.searchParams.append("location", `${params.lat},${params.lng}`);
      url.searchParams.append("radius", params.radius.toString());
      url.searchParams.append("key", this.apiKey);

      if (params.type) {
        url.searchParams.append("type", params.type);
      }

      if (params.keyword) {
        url.searchParams.append("keyword", params.keyword);
      }

      // Call API
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        throw new Error(`Google Places API status: ${data.status}`);
      }

      // Transform results
      const results = this.transformPlaces(data.results || [], {
        lat: params.lat,
        lng: params.lng,
      });

      // Cache results
      await this.saveToCache(cacheKey, results);

      // Optionally import to local database
      await this.importToDatabase(results);

      return results;
    } catch (error) {
      console.error("Google Places nearby search error:", error);
      return [];
    }
  }

  /**
   * Search by text query
   */
  async searchText(params: TextSearchParams): Promise<PlaceResult[]> {
    if (!this.isAvailable()) {
      console.warn("Google Places API not available - using fallback");
      return [];
    }

    try {
      // Check cache first
      const cacheKey = this.getCacheKey("text", params);
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        console.log("Google Places cache hit");
        return cached;
      }

      // Build query
      let query = params.query;
      if (params.location) {
        query += ` in ${params.location}`;
      }

      // Build API URL
      const url = new URL(`${this.baseUrl}/textsearch/json`);
      url.searchParams.append("query", query);
      url.searchParams.append("key", this.apiKey);

      if (params.radius) {
        url.searchParams.append("radius", params.radius.toString());
      }

      // Call API
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        throw new Error(`Google Places API status: ${data.status}`);
      }

      // Transform results
      const results = this.transformPlaces(data.results || []);

      // Cache results
      await this.saveToCache(cacheKey, results);

      // Optionally import to local database
      await this.importToDatabase(results);

      return results;
    } catch (error) {
      console.error("Google Places text search error:", error);
      return [];
    }
  }

  /**
   * Get detailed information about a place
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      // Check cache first
      const cacheKey = `place_details:${placeId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached && cached.length > 0) {
        return cached[0];
      }

      // Build API URL
      const url = new URL(`${this.baseUrl}/details/json`);
      url.searchParams.append("place_id", placeId);
      url.searchParams.append("key", this.apiKey);
      url.searchParams.append(
        "fields",
        "name,formatted_address,formatted_phone_number,international_phone_number," +
          "opening_hours,rating,reviews,website,geometry,photos,price_level,types"
      );

      // Call API
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== "OK") {
        throw new Error(`Google Places API status: ${data.status}`);
      }

      // Transform result
      const details = this.transformPlaceDetails(data.result);

      // Cache result
      await this.saveToCache(cacheKey, [details]);

      return details;
    } catch (error) {
      console.error("Google Places details error:", error);
      return null;
    }
  }

  /**
   * Get photo URL
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${this.baseUrl}/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${this.apiKey}`;
  }

  // =====================================================
  // PRIVATE HELPERS
  // =====================================================

  /**
   * Transform Google Places results to our format
   */
  private transformPlaces(
    places: any[],
    userLocation?: { lat: number; lng: number }
  ): PlaceResult[] {
    return places.map((place) => {
      const result: PlaceResult = {
        id: place.place_id,
        name: place.name,
        address: place.formatted_address || place.vicinity || "",
        lat: place.geometry?.location?.lat || 0,
        lng: place.geometry?.location?.lng || 0,
        rating: place.rating,
        review_count: place.user_ratings_total,
        category: place.types?.[0] || "other",
        source: "google_places",
      };

      // Calculate distance if user location provided
      if (userLocation && result.lat && result.lng) {
        result.distance_km = this.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          result.lat,
          result.lng
        );
      }

      // Add photo if available
      if (place.photos && place.photos.length > 0) {
        result.photos = [this.getPhotoUrl(place.photos[0].photo_reference)];
      }

      return result;
    });
  }

  /**
   * Transform place details
   */
  private transformPlaceDetails(place: any): PlaceDetails {
    const base = this.transformPlaces([place])[0];

    return {
      ...base,
      formatted_phone_number: place.formatted_phone_number,
      international_phone_number: place.international_phone_number,
      phone: place.formatted_phone_number || place.international_phone_number,
      website: place.website,
      opening_hours: place.opening_hours,
      opening_hours_text: place.opening_hours?.weekday_text,
      price_level: place.price_level,
      reviews: place.reviews?.slice(0, 5).map((r: any) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: new Date(r.time * 1000).toISOString(),
      })),
      photos_urls:
        place.photos?.slice(0, 5).map((p: any) => this.getPhotoUrl(p.photo_reference)) || [],
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(type: string, params: any): string {
    const paramsStr = JSON.stringify(params);
    return `google_places:${type}:${paramsStr}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<PlaceResult[] | null> {
    try {
      const { data, error } = await this.supabase
        .from("api_cache")
        .select("value, created_at")
        .eq("key", key)
        .single();

      if (error || !data) {
        return null;
      }

      // Check if cache is still valid
      const cacheAge = Date.now() - new Date(data.created_at).getTime();
      if (cacheAge > this.cacheTTL) {
        // Cache expired, delete it
        await this.supabase.from("api_cache").delete().eq("key", key);
        return null;
      }

      return data.value as PlaceResult[];
    } catch (error) {
      console.error("Cache read error:", error);
      return null;
    }
  }

  /**
   * Save to cache
   */
  private async saveToCache(key: string, value: PlaceResult[]): Promise<void> {
    try {
      await this.supabase.from("api_cache").upsert({
        key,
        value,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Cache write error:", error);
    }
  }

  /**
   * Import places to local business directory
   */
  private async importToDatabase(places: PlaceResult[]): Promise<void> {
    if (places.length === 0) return;

    try {
      const records = places.map((place) => ({
        name: place.name,
        category: place.category || "other",
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        phone: place.phone,
        website: place.website,
        rating: place.rating,
        review_count: place.review_count,
        source: "google_places",
        external_id: place.id,
        status: "ACTIVE",
        imported_at: new Date().toISOString(),
      }));

      // Upsert based on external_id
      await this.supabase
        .from("business_directory")
        .upsert(records, {
          onConflict: "external_id",
          ignoreDuplicates: false,
        });

      console.log(`Imported ${records.length} places to business directory`);
    } catch (error) {
      console.error("Database import error:", error);
      // Non-critical error, continue
    }
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Create Google Places tool instance
 */
export function createGooglePlacesTool(supabase: SupabaseClient): GooglePlacesTool {
  return new GooglePlacesTool(supabase);
}

/**
 * Hybrid search: Local DB + Google Places
 */
export async function searchHybrid(
  supabase: SupabaseClient,
  query: string,
  location: { lat: number; lng: number },
  radiusKm: number = 10
): Promise<PlaceResult[]> {
  const results: PlaceResult[] = [];

  // 1. Search local database first
  try {
    const { data: localResults } = await supabase.rpc("search_nearby_businesses", {
      _lat: location.lat,
      _lng: location.lng,
      _radius_km: radiusKm,
      _query: query,
      _limit: 10,
    });

    if (localResults) {
      results.push(
        ...localResults.map((b: any) => ({
          ...b,
          source: "database",
        }))
      );
    }
  } catch (error) {
    console.error("Local search error:", error);
  }

  // 2. Search Google Places if available
  const placesTool = createGooglePlacesTool(supabase);
  if (placesTool.isAvailable()) {
    try {
      const googleResults = await placesTool.searchNearby({
        lat: location.lat,
        lng: location.lng,
        radius: radiusKm * 1000, // Convert km to meters
        keyword: query,
      });

      // Merge results, avoiding duplicates
      for (const place of googleResults) {
        const isDuplicate = results.some(
          (r) =>
            r.name.toLowerCase() === place.name.toLowerCase() &&
            Math.abs(r.lat - place.lat) < 0.001 &&
            Math.abs(r.lng - place.lng) < 0.001
        );

        if (!isDuplicate) {
          results.push(place);
        }
      }
    } catch (error) {
      console.error("Google Places search error:", error);
    }
  }

  // 3. Sort by distance
  results.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));

  return results.slice(0, 10);
}
