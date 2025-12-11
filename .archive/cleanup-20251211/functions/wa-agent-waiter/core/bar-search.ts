/**
 * Bar Search Functions
 * Helper functions for searching and retrieving bar/restaurant data
 * 
 * Part of Waiter AI Agent Discovery Flow
 * Created: 2025-12-09
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface Bar {
  id: string;
  name: string;
  slug: string;
  city_area: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  whatsapp_number: string | null;
  is_active: boolean;
  google_maps_url: string | null;
  features: Record<string, any> | null;
}

export interface BarSearchResult extends Bar {
  distance_km?: number;
}

/**
 * Search bars by location (nearby search)
 */
export async function searchBarsNearby(
  supabase: SupabaseClient,
  latitude: number,
  longitude: number,
  radiusKm: number = 10,
  limit: number = 5
): Promise<BarSearchResult[]> {
  // Use PostGIS ST_DWithin for efficient spatial query
  const { data, error } = await supabase.rpc('search_bars_nearby', {
    p_lat: latitude,
    p_lng: longitude,
    p_radius_km: radiusKm,
    p_limit: limit
  });

  if (error) {
    // Fallback to simpler query if RPC doesn't exist
    console.warn('search_bars_nearby RPC not found, using fallback query');
    return searchBarsFallback(supabase, latitude, longitude, radiusKm, limit);
  }

  return data || [];
}

/**
 * Search bars by name (text search)
 */
export async function searchBarsByName(
  supabase: SupabaseClient,
  searchTerm: string,
  limit: number = 5
): Promise<Bar[]> {
  const { data, error } = await supabase
    .from('bars')
    .select('*')
    .eq('is_active', true)
    .or(`name.ilike.%${searchTerm}%,city_area.ilike.%${searchTerm}%,location_text.ilike.%${searchTerm}%`)
    .limit(limit);

  if (error) {
    console.error('Error searching bars by name:', error);
    return [];
  }

  return data || [];
}

/**
 * Get bar by ID
 */
export async function getBarById(
  supabase: SupabaseClient,
  barId: string
): Promise<Bar | null> {
  const { data, error } = await supabase
    .from('bars')
    .select('*')
    .eq('id', barId)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Error getting bar by ID:', error);
    return null;
  }

  return data;
}

/**
 * Fallback search using haversine formula (when PostGIS function not available)
 */
async function searchBarsFallback(
  supabase: SupabaseClient,
  latitude: number,
  longitude: number,
  radiusKm: number,
  limit: number
): Promise<BarSearchResult[]> {
  // Get all active bars with coordinates
  const { data, error } = await supabase
    .from('bars')
    .select('*')
    .eq('is_active', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error || !data) {
    console.error('Error in fallback bar search:', error);
    return [];
  }

  // Calculate distances using haversine formula
  const barsWithDistance = data.map((bar) => {
    const distance = calculateDistance(
      latitude,
      longitude,
      bar.latitude!,
      bar.longitude!
    );
    return {
      ...bar,
      distance_km: distance
    };
  });

  // Filter by radius and sort by distance
  const nearbyBars = barsWithDistance
    .filter(bar => bar.distance_km! <= radiusKm)
    .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0))
    .slice(0, limit);

  return nearbyBars;
}

/**
 * Calculate distance between two points using haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
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
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Parse location from WhatsApp location message
 * Format: "Location: lat,lng" or just "lat,lng"
 */
export function parseLocationMessage(message: string): { lat: number; lng: number } | null {
  // Try to extract coordinates from message
  const coordRegex = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/;
  const match = message.match(coordRegex);
  
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    // Validate coordinates (rough bounds for Rwanda/East Africa)
    if (lat >= -3 && lat <= 0 && lng >= 28 && lng <= 32) {
      return { lat, lng };
    }
  }
  
  return null;
}

/**
 * Parse selection number from user input (1-5)
 */
export function parseSelectionNumber(message: string): number | null {
  const trimmed = message.trim();
  
  // Check if it's just a number
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    if (num >= 1 && num <= 5) {
      return num;
    }
  }
  
  // Check for emoji number selection
  const emojiMap: Record<string, number> = {
    '1️⃣': 1,
    '2️⃣': 2,
    '3️⃣': 3,
    '4️⃣': 4,
    '5️⃣': 5,
  };
  
  for (const [emoji, num] of Object.entries(emojiMap)) {
    if (trimmed.includes(emoji)) {
      return num;
    }
  }
  
  return null;
}

/**
 * Format bar list for display with emoji numbers
 */
export function formatBarList(bars: BarSearchResult[]): string {
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
  
  return bars.map((bar, index) => {
    const emoji = emojis[index] || `${index + 1}.`;
    const distance = bar.distance_km ? ` (${bar.distance_km}km away)` : '';
    const area = bar.city_area ? ` - ${bar.city_area}` : '';
    const location = bar.location_text ? `\n   📍 ${bar.location_text}` : '';
    
    return `${emoji} **${bar.name}**${area}${distance}${location}`;
  }).join('\n\n');
}
