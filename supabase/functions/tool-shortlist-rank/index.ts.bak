// Tool: Shortlist Rank
// AI-powered property ranking and shortlist generation with explanations
// Implements scoring algorithm and generates Top-5 recommendations

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RankRequest {
  request_id: string;
  candidate_listings: Array<{
    listing_id: string;
    distance_km?: number;
  }>;
  user_preferences: {
    budget_max?: number;
    bedrooms_min?: number;
    preferred_amenities?: string[];
    location_priority?: number; // 0-10
    price_priority?: number; // 0-10
    amenities_priority?: number; // 0-10
  };
}

interface ScoredListing {
  listing_id: string;
  rank: number;
  match_score: number;
  scores: {
    location: number;
    price: number;
    size: number;
    amenities: number;
    availability: number;
  };
  pros: string[];
  cons: string[];
  ai_explanation: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get("x-correlation-id") ||
    crypto.randomUUID();
  const startTime = Date.now();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const request: RankRequest = await req.json();

    console.log(
      JSON.stringify({
        event: "SHORTLIST_RANK_START",
        correlationId,
        requestId: request.request_id,
        candidateCount: request.candidate_listings.length,
        timestamp: new Date().toISOString(),
      }),
    );

    // Fetch full listing details
    const listingIds = request.candidate_listings.map((c) => c.listing_id);
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("*")
      .in("id", listingIds);

    if (listingsError) throw listingsError;
    if (!listings || listings.length === 0) {
      throw new Error("No listings found for given IDs");
    }

    // Fetch property request details for context
    const { data: propertyRequest, error: requestError } = await supabase
      .from("property_requests")
      .select("*")
      .eq("id", request.request_id)
      .single();

    if (requestError) throw requestError;

    // Score each listing
    const scoredListings: ScoredListing[] = listings.map((listing) => {
      const candidate = request.candidate_listings.find(
        (c) => c.listing_id === listing.id,
      );
      const distance = candidate?.distance_km || 0;

      const scores = calculateScores(
        listing,
        propertyRequest,
        request.user_preferences,
        distance,
      );

      const totalScore = (
        scores.location * (request.user_preferences.location_priority || 7) +
        scores.price * (request.user_preferences.price_priority || 8) +
        scores.size * 5 +
        scores.amenities *
          (request.user_preferences.amenities_priority || 6) +
        scores.availability * 4
      ) / 30; // Weighted average

      const { pros, cons } = generateProsAndCons(
        listing,
        propertyRequest,
        scores,
        distance,
      );

      const aiExplanation = generateExplanation(
        listing,
        scores,
        totalScore,
        pros,
        cons,
      );

      return {
        listing_id: listing.id,
        rank: 0, // Will be assigned after sorting
        match_score: Math.round(totalScore),
        scores,
        pros,
        cons,
        ai_explanation: aiExplanation,
      };
    });

    // Sort by match score and assign ranks
    scoredListings.sort((a, b) => b.match_score - a.match_score);
    scoredListings.forEach((listing, index) => {
      listing.rank = index + 1;
    });

    // Take top 5
    const top5 = scoredListings.slice(0, 5);

    // Save shortlist to database
    const { data: shortlist, error: shortlistError } = await supabase
      .from("shortlists")
      .insert({
        request_id: request.request_id,
        items: top5,
        algorithm_version: "v1",
        generation_time_ms: Date.now() - startTime,
      })
      .select()
      .single();

    if (shortlistError) throw shortlistError;

    console.log(
      JSON.stringify({
        event: "SHORTLIST_RANK_COMPLETE",
        correlationId,
        requestId: request.request_id,
        shortlistId: shortlist.id,
        topScore: top5[0]?.match_score,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }),
    );

    return new Response(
      JSON.stringify({
        success: true,
        shortlist_id: shortlist.id,
        top_5: top5,
        total_candidates: listings.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "SHORTLIST_RANK_ERROR",
        correlationId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }),
    );

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function calculateScores(
  listing: any,
  request: any,
  preferences: any,
  distance: number,
): { location: number; price: number; size: number; amenities: number; availability: number } {
  // Location score (0-100)
  let locationScore = 100;
  if (distance > 0) {
    locationScore = Math.max(0, 100 - (distance * 10)); // -10 points per km
  }

  // Price score (0-100)
  let priceScore = 100;
  if (request.budget_max && listing.price_amount > 0) {
    const priceRatio = listing.price_amount / request.budget_max;
    if (priceRatio <= 1) {
      priceScore = 100 - (priceRatio * 20); // Best if under budget
    } else {
      priceScore = Math.max(0, 100 - ((priceRatio - 1) * 100)); // Penalize over budget
    }
  }

  // Size score (0-100)
  let sizeScore = 100;
  if (request.bedrooms_min && listing.bedrooms > 0) {
    if (listing.bedrooms >= request.bedrooms_min) {
      sizeScore = 100;
    } else {
      sizeScore = (listing.bedrooms / request.bedrooms_min) * 100;
    }
  }

  // Amenities score (0-100)
  let amenitiesScore = 50; // Base score
  if (preferences.preferred_amenities && preferences.preferred_amenities.length > 0) {
    const matchingAmenities = preferences.preferred_amenities.filter(
      (a: string) => listing.amenities?.includes(a),
    );
    amenitiesScore = (matchingAmenities.length / preferences.preferred_amenities.length) * 100;
  }

  // Availability score (0-100)
  const availabilityScore = listing.active ? 100 : 0;

  return {
    location: Math.round(locationScore),
    price: Math.round(priceScore),
    size: Math.round(sizeScore),
    amenities: Math.round(amenitiesScore),
    availability: availabilityScore,
  };
}

function generateProsAndCons(
  listing: any,
  request: any,
  scores: any,
  distance: number,
): { pros: string[]; cons: string[] } {
  const pros: string[] = [];
  const cons: string[] = [];

  // Location
  if (scores.location > 80) {
    pros.push(`Great location${distance > 0 ? ` (${distance.toFixed(1)}km away)` : ""}`);
  } else if (scores.location < 50) {
    cons.push(`Farther from preferred area (${distance.toFixed(1)}km)`);
  }

  // Price
  if (scores.price > 80) {
    pros.push("Excellent value for money");
  } else if (scores.price < 50) {
    cons.push("Above budget");
  }

  // Size
  if (listing.bedrooms > (request.bedrooms_min || 0)) {
    pros.push(`Spacious with ${listing.bedrooms} bedrooms`);
  } else if (scores.size < 100) {
    cons.push("Smaller than requested");
  }

  // Amenities
  if (scores.amenities > 70) {
    pros.push("Has most requested amenities");
  }

  // Special features
  if (listing.furnished) {
    pros.push("Fully furnished");
  }
  if (listing.verified) {
    pros.push("Verified listing");
  }

  // Ensure at least one pro
  if (pros.length === 0) {
    pros.push("Available now");
  }

  return { pros, cons };
}

function generateExplanation(
  listing: any,
  scores: any,
  totalScore: number,
  pros: string[],
  cons: string[],
): string {
  const parts: string[] = [];

  parts.push(
    `This ${listing.property_type} scored ${Math.round(totalScore)}/100 overall.`,
  );

  if (pros.length > 0) {
    parts.push(`Highlights: ${pros.join(", ")}.`);
  }

  if (cons.length > 0) {
    parts.push(`Considerations: ${cons.join(", ")}.`);
  }

  // Add specific insights
  if (scores.location > 80 && scores.price > 80) {
    parts.push(
      "Strong match on both location and price — highly recommended.",
    );
  } else if (scores.location > 80) {
    parts.push("Prime location, though slightly above budget.");
  } else if (scores.price > 80) {
    parts.push("Great value, though not in the most central area.");
  }

  return parts.join(" ");
}
