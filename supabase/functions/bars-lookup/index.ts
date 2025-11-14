import { corsHeaders } from "../_shared/http.ts";
import { getServiceClient } from "shared/supabase.ts";

const supabase = getServiceClient();

interface BarsLookupRequest {
  lat?: number;
  lng?: number;
  radius_km?: number;
  limit?: number;
  // Feature filters (Top 8 Preferences)
  live_music?: boolean;
  parking?: boolean;
  wifi?: boolean;
  family_friendly?: boolean;
  vegetarian?: boolean;
  sports?: boolean;
  outdoor?: boolean;
  late_night?: boolean;
  events?: boolean;
  karaoke?: boolean;
  happy_hour?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: BarsLookupRequest = await req.json();
    const { lat, lng, radius_km = 10, limit = 20, ...filters } = body;

    if (lat === undefined || lng === undefined) {
      return new Response(
        JSON.stringify({ error: "Location required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasFilters = Object.values(filters).some(v => v === true);
    let results = [];

    // Try with filters first
    if (hasFilters) {
      const { data } = await supabase.rpc("nearby_bars", {
        user_lat: lat,
        user_lon: lng,
        radius_km,
        _limit: limit,
        filter_live_music: filters.live_music,
        filter_parking: filters.parking,
        filter_wifi: filters.wifi,
        filter_family_friendly: filters.family_friendly,
        filter_vegetarian: filters.vegetarian,
        filter_sports: filters.sports,
        filter_outdoor: filters.outdoor,
        filter_late_night: filters.late_night,
        filter_events: filters.events,
        filter_karaoke: filters.karaoke,
        filter_happy_hour: filters.happy_hour,
      });
      results = data || [];
    }

    // FALLBACK: Always return nearby bars if filtered search returns nothing
    if (results.length === 0) {
      const { data } = await supabase.rpc("nearby_bars", {
        user_lat: lat,
        user_lon: lng,
        radius_km,
        _limit: limit,
      });
      results = data || [];
    }

    return new Response(
      JSON.stringify({ results, fallback_used: hasFilters && results.length > 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Bars lookup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
