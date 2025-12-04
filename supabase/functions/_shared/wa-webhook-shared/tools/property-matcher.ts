/**
 * Property Matching Tool
 * Searches properties table and creates match events for AI agent
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PropertySearchParams {
  location?: string;
  bedrooms?: number;
  bathrooms?: number;
  property_type?: string;
  min_monthly_rent?: number;
  max_monthly_rent?: number;
  min_sale_price?: number;
  max_sale_price?: number;
  listing_type?: "rent" | "sale";
  furnished?: boolean;
  limit?: number;
}

export interface PropertyMatch {
  id: string;
  title: string;
  location: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent?: number;
  sale_price?: number;
  listing_type: string;
  furnished: boolean;
  description: string;
  images?: string[];
  match_score: number;
  distance_km?: number;
}

export async function searchProperties(
  supabase: SupabaseClient,
  params: PropertySearchParams,
  userLocation?: { lat: number; lng: number }
): Promise<{ matches: PropertyMatch[]; total: number }> {
  try {
    // Build query
    let query = supabase
      .from("properties")
      .select("*", { count: "exact" })
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // Apply filters
    if (params.location) {
      query = query.ilike("location", `%${params.location}%`);
    }

    if (params.bedrooms) {
      query = query.gte("bedrooms", params.bedrooms);
    }

    if (params.bathrooms) {
      query = query.gte("bathrooms", params.bathrooms);
    }

    if (params.property_type) {
      query = query.eq("property_type", params.property_type);
    }

    if (params.listing_type) {
      query = query.eq("listing_type", params.listing_type);
    }

    if (params.furnished !== undefined) {
      query = query.eq("furnished", params.furnished);
    }

    // Price filters
    if (params.listing_type === "rent") {
      if (params.min_monthly_rent) {
        query = query.gte("monthly_rent", params.min_monthly_rent);
      }
      if (params.max_monthly_rent) {
        query = query.lte("monthly_rent", params.max_monthly_rent);
      }
    } else if (params.listing_type === "sale") {
      if (params.min_sale_price) {
        query = query.gte("sale_price", params.min_sale_price);
      }
      if (params.max_sale_price) {
        query = query.lte("sale_price", params.max_sale_price);
      }
    }

    // Limit results
    const limit = params.limit || 10;
    query = query.limit(limit);

    const { data: properties, error, count } = await query;

    if (error) {
      console.error("Property search error:", error);
      return { matches: [], total: 0 };
    }

    // Calculate match scores and distances
    const matches: PropertyMatch[] = (properties || []).map((prop) => {
      let matchScore = 0.5; // Base score

      // Boost score for location match
      if (params.location && prop.location?.toLowerCase().includes(params.location.toLowerCase())) {
        matchScore += 0.15;
      }

      // Boost score for exact bedroom match
      if (params.bedrooms && prop.bedrooms === params.bedrooms) {
        matchScore += 0.15;
      } else if (params.bedrooms && prop.bedrooms >= params.bedrooms) {
        matchScore += 0.1;
      }

      // Boost score for price within budget
      if (params.listing_type === "rent" && params.max_monthly_rent) {
        if (prop.monthly_rent && prop.monthly_rent <= params.max_monthly_rent) {
          matchScore += 0.15;
        }
      }

      // Boost for furnished match
      if (params.furnished !== undefined && prop.furnished === params.furnished) {
        matchScore += 0.05;
      }

      // Calculate distance if user location provided
      let distance_km: number | undefined;
      if (userLocation && prop.latitude && prop.longitude) {
        distance_km = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          prop.latitude,
          prop.longitude
        );

        // Boost score for proximity (within 5km)
        if (distance_km < 5) {
          matchScore += 0.1;
        }
      }

      return {
        id: prop.id,
        title: prop.title || `${prop.bedrooms}BR ${prop.property_type}`,
        location: prop.location || "Not specified",
        property_type: prop.property_type || "Property",
        bedrooms: prop.bedrooms || 0,
        bathrooms: prop.bathrooms || 0,
        monthly_rent: prop.monthly_rent,
        sale_price: prop.sale_price,
        listing_type: prop.listing_type || "rent",
        furnished: prop.furnished || false,
        description: prop.description?.substring(0, 200) || "",
        images: prop.images || [],
        match_score: Math.min(matchScore, 1.0),
        distance_km,
      };
    });

    // Sort by match score, then by distance
    matches.sort((a, b) => {
      if (Math.abs(a.match_score - b.match_score) > 0.05) {
        return b.match_score - a.match_score;
      }
      if (a.distance_km && b.distance_km) {
        return a.distance_km - b.distance_km;
      }
      return 0;
    });

    return {
      matches,
      total: count || 0,
    };
  } catch (error) {
    console.error("Property search exception:", error);
    return { matches: [], total: 0 };
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
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
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export async function createPropertyMatchEvents(
  supabase: SupabaseClient,
  userId: string,
  agentId: string,
  conversationId: string,
  matches: PropertyMatch[]
): Promise<void> {
  try {
    // Create match events for each property
    const matchEvents = matches.map((property) => ({
      user_id: userId,
      agent_id: agentId,
      conversation_id: conversationId,
      match_type: "property",
      entity_id: property.id,
      entity_type: "property",
      match_score: property.match_score,
      match_reason: `Property: ${property.title} in ${property.location}`,
      metadata: {
        title: property.title,
        location: property.location,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        price: property.listing_type === "rent" ? property.monthly_rent : property.sale_price,
        listing_type: property.listing_type,
        distance_km: property.distance_km,
      },
      status: "pending",
    }));

    if (matchEvents.length > 0) {
      const { error } = await supabase
        .from("ai_agent_match_events")
        .insert(matchEvents);

      if (error) {
        console.error("Error creating property match events:", error);
      } else {
        console.log(`Created ${matchEvents.length} property match events`);
      }
    }
  } catch (error) {
    console.error("Exception creating property match events:", error);
  }
}

export function formatPropertiesForWhatsApp(matches: PropertyMatch[], limit: number = 5): string {
  if (matches.length === 0) {
    return "😔 No properties found matching your criteria.\n\nTry adjusting your search or check back later!";
  }

  const topMatches = matches.slice(0, limit);
  let message = `🏠 Found ${matches.length} propert${matches.length > 1 ? "ies" : "y"}!\n\n`;
  message += `Here are the top ${topMatches.length}:\n\n`;

  topMatches.forEach((prop, index) => {
    message += `${index + 1}. *${prop.title}*\n`;
    message += `   📍 ${prop.location}`;
    if (prop.distance_km) {
      message += ` (${prop.distance_km.toFixed(1)}km away)`;
    }
    message += `\n`;
    message += `   🛏️ ${prop.bedrooms} bed, 🚿 ${prop.bathrooms} bath\n`;

    if (prop.listing_type === "rent" && prop.monthly_rent) {
      message += `   💰 ${prop.monthly_rent.toLocaleString()} RWF/month\n`;
    } else if (prop.listing_type === "sale" && prop.sale_price) {
      message += `   💰 ${prop.sale_price.toLocaleString()} RWF\n`;
    }

    if (prop.furnished) {
      message += `   ✨ Furnished\n`;
    }
    message += `   ⭐ Match: ${Math.round(prop.match_score * 100)}%\n\n`;
  });

  if (matches.length > limit) {
    message += `_...and ${matches.length - limit} more matches!_\n\n`;
  }

  message += `Reply with a number to see photos and details, or "schedule viewing" to book a visit! 🔑`;

  return message;
}
