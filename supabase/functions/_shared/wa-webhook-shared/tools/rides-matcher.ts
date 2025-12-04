/**
 * Rides Matching Tool
 * Matches drivers with passengers and manages trip requests
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RideSearchParams {
  pickup_address?: string;
  dropoff_address?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
  vehicle_type?: string;
  scheduled_at?: string | null;
  urgent?: boolean;
  max_distance_km?: number;
}

export interface DriverMatch {
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  vehicle_type: string;
  vehicle_plate: string;
  current_lat: number;
  current_lng: number;
  distance_km: number;
  eta_minutes: number;
  rating: number;
  total_trips: number;
  is_online: boolean;
  match_score: number;
}

export async function findNearbyDrivers(
  supabase: SupabaseClient,
  params: RideSearchParams,
  maxResults: number = 10
): Promise<{ drivers: DriverMatch[]; total: number }> {
  try {
    if (!params.pickup_lat || !params.pickup_lng) {
      console.error("Pickup coordinates required for driver search");
      return { drivers: [], total: 0 };
    }

    // Query online drivers
    let query = supabase
      .from("rides_driver_status")
      .select(`
        *,
        profiles!inner(id, full_name, phone)
      `)
      .eq("status", "online")
      .not("current_lat", "is", null)
      .not("current_lng", "is", null);

    // Filter by vehicle type if specified
    if (params.vehicle_type) {
      query = query.eq("vehicle_type", params.vehicle_type);
    }

    const { data: drivers, error } = await query;

    if (error) {
      console.error("Driver search error:", error);
      return { drivers: [], total: 0 };
    }

    if (!drivers || drivers.length === 0) {
      return { drivers: [], total: 0 };
    }

    // Calculate distances and match scores
    const maxDistance = params.max_distance_km || 10; // Default 10km radius
    const driverMatches: DriverMatch[] = drivers
      .map((driver) => {
        const distance_km = calculateDistance(
          params.pickup_lat!,
          params.pickup_lng!,
          driver.current_lat,
          driver.current_lng
        );

        // Skip drivers too far away
        if (distance_km > maxDistance) {
          return null;
        }

        // Calculate ETA (rough estimate: 30km/h average speed)
        const eta_minutes = Math.ceil((distance_km / 30) * 60);

        // Calculate match score
        let matchScore = 1.0;

        // Penalize for distance (closer is better)
        matchScore -= (distance_km / maxDistance) * 0.3;

        // Boost for high rating
        if (driver.average_rating) {
          matchScore += (driver.average_rating - 3) * 0.1; // Boost for ratings above 3
        }

        // Boost for vehicle type match
        if (params.vehicle_type && driver.vehicle_type === params.vehicle_type) {
          matchScore += 0.1;
        }

        // Boost for urgent requests and very close drivers
        if (params.urgent && distance_km < 2) {
          matchScore += 0.15;
        }

        return {
          driver_id: driver.user_id,
          driver_name: driver.profiles?.full_name || "Driver",
          driver_phone: driver.profiles?.phone || "",
          vehicle_type: driver.vehicle_type || "car",
          vehicle_plate: driver.vehicle_plate || "N/A",
          current_lat: driver.current_lat,
          current_lng: driver.current_lng,
          distance_km,
          eta_minutes,
          rating: driver.average_rating || 0,
          total_trips: driver.total_trips || 0,
          is_online: driver.status === "online",
          match_score: Math.max(0, Math.min(matchScore, 1.0)),
        };
      })
      .filter((match): match is DriverMatch => match !== null);

    // Sort by match score, then by distance
    driverMatches.sort((a, b) => {
      if (Math.abs(a.match_score - b.match_score) > 0.05) {
        return b.match_score - a.match_score;
      }
      return a.distance_km - b.distance_km;
    });

    return {
      drivers: driverMatches.slice(0, maxResults),
      total: driverMatches.length,
    };
  } catch (error) {
    console.error("Driver search exception:", error);
    return { drivers: [], total: 0 };
  }
}

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

export async function createDriverMatchEvents(
  supabase: SupabaseClient,
  userId: string,
  agentId: string,
  conversationId: string,
  drivers: DriverMatch[],
  rideParams: RideSearchParams
): Promise<void> {
  try {
    // Create match events for each driver
    const matchEvents = drivers.map((driver) => ({
      user_id: userId,
      agent_id: agentId,
      conversation_id: conversationId,
      match_type: "driver",
      entity_id: driver.driver_id,
      entity_type: "driver",
      match_score: driver.match_score,
      match_reason: `Driver ${driver.driver_name} - ${driver.distance_km.toFixed(1)}km away, ETA ${driver.eta_minutes}min`,
      metadata: {
        driver_name: driver.driver_name,
        vehicle_type: driver.vehicle_type,
        vehicle_plate: driver.vehicle_plate,
        distance_km: driver.distance_km,
        eta_minutes: driver.eta_minutes,
        rating: driver.rating,
        pickup_address: rideParams.pickup_address,
        dropoff_address: rideParams.dropoff_address,
      },
      status: "pending",
    }));

    if (matchEvents.length > 0) {
      const { error } = await supabase
        .from("ai_agent_match_events")
        .insert(matchEvents);

      if (error) {
        console.error("Error creating driver match events:", error);
      } else {
        console.log(`Created ${matchEvents.length} driver match events`);
      }
    }
  } catch (error) {
    console.error("Exception creating driver match events:", error);
  }
}

export async function createTripRequest(
  supabase: SupabaseClient,
  userId: string,
  params: RideSearchParams
): Promise<{ tripId: string | null; error: string | null }> {
  try {
    const tripData: any = {
      passenger_id: userId,
      status: "pending",
      vehicle_type: params.vehicle_type || "car",
      pickup_address: params.pickup_address,
      dropoff_address: params.dropoff_address,
      pickup_lat: params.pickup_lat,
      pickup_lng: params.pickup_lng,
      dropoff_lat: params.dropoff_lat,
      dropoff_lng: params.dropoff_lng,
      requested_at: new Date().toISOString(),
    };

    if (params.scheduled_at) {
      tripData.scheduled_at = params.scheduled_at;
      tripData.status = "scheduled";
    }

    const { data, error } = await supabase
      .from("rides_trips")
      .insert(tripData)
      .select("id")
      .single();

    if (error) {
      console.error("Error creating trip request:", error);
      return { tripId: null, error: error.message };
    }

    return { tripId: data.id, error: null };
  } catch (error) {
    console.error("Exception creating trip request:", error);
    return { tripId: null, error: (error as Error).message };
  }
}

export function formatDriversForWhatsApp(drivers: DriverMatch[], limit: number = 5): string {
  if (drivers.length === 0) {
    return "😔 No drivers available nearby right now.\n\nPlease try again in a few minutes or expand your search area!";
  }

  const topDrivers = drivers.slice(0, limit);
  let message = `🚗 Found ${drivers.length} driver${drivers.length > 1 ? "s" : ""} nearby!\n\n`;

  topDrivers.forEach((driver, index) => {
    message += `${index + 1}. *${driver.driver_name}*\n`;
    message += `   🚙 ${driver.vehicle_type.toUpperCase()} - ${driver.vehicle_plate}\n`;
    message += `   📍 ${driver.distance_km.toFixed(1)}km away\n`;
    message += `   ⏱️ ETA: ${driver.eta_minutes} min\n`;
    if (driver.rating > 0) {
      message += `   ⭐ ${driver.rating.toFixed(1)}/5 (${driver.total_trips} trips)\n`;
    }
    message += `   💯 Match: ${Math.round(driver.match_score * 100)}%\n\n`;
  });

  if (drivers.length > limit) {
    message += `_...and ${drivers.length - limit} more drivers!_\n\n`;
  }

  message += `Reply with a number to request that driver, or "any" for the closest one! 🚕`;

  return message;
}
