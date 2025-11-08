// ML Pattern Learning Service for predicting user behavior
import type { SupabaseClient } from "npm:@supabase/supabase-js@^2";

export interface TravelPattern {
  userId: string;
  dayOfWeek: number;
  hour: number;
  pickupLocation: { lat: number; lng: number };
  dropoffLocation: { lat: number; lng: number };
  vehicleType: string;
  frequencyCount: number;
}

export interface PatternPrediction {
  dayOfWeek: number;
  hour: number;
  probability: number;
  suggestedVehicle: string;
  estimatedRoute: any;
}

// Analyze user travel patterns
export async function analyzeUserPatterns(
  supabase: SupabaseClient,
  userId: string,
  daysBack: number = 30,
): Promise<{
  patterns: any[];
  predictions: PatternPrediction[];
  insights: string[];
}> {
  // Get user's travel history
  const { data: patterns, error } = await supabase
    .rpc("get_user_travel_patterns", {
      p_user_id: userId,
      p_days_back: daysBack,
    });

  if (error) {
    console.error("Pattern analysis error:", error);
    return { patterns: [], predictions: [], insights: [] };
  }

  if (!patterns || patterns.length === 0) {
    return {
      patterns: [],
      predictions: [],
      insights: ["Not enough travel history to detect patterns."],
    };
  }

  // Generate predictions
  const predictions = generatePredictions(patterns);

  // Generate insights
  const insights = generateInsights(patterns);

  return { patterns, predictions, insights };
}

// Generate trip predictions based on patterns
function generatePredictions(patterns: any[]): PatternPrediction[] {
  const predictions: PatternPrediction[] = [];

  // Sort by frequency
  const sortedPatterns = patterns.sort((a, b) => b.trip_count - a.trip_count);

  for (const pattern of sortedPatterns.slice(0, 5)) {
    if (pattern.trip_count >= 3) {
      // Pattern is significant enough to predict
      const probability = calculateProbability(pattern.trip_count, patterns.length);

      predictions.push({
        dayOfWeek: pattern.day_of_week,
        hour: pattern.hour,
        probability,
        suggestedVehicle: pattern.most_common_vehicle,
        estimatedRoute: null, // Would be populated with actual route data
      });
    }
  }

  return predictions;
}

// Calculate prediction probability
function calculateProbability(frequency: number, totalPatterns: number): number {
  const baseProb = frequency / totalPatterns;
  
  // Boost probability for recent and frequent patterns
  const recencyFactor = 1.2;
  const frequencyFactor = Math.min(frequency / 10, 1.5);
  
  const probability = Math.min(baseProb * recencyFactor * frequencyFactor, 0.95);
  
  return Math.round(probability * 100) / 100;
}

// Generate insights from patterns
function generateInsights(patterns: any[]): string[] {
  const insights: string[] = [];

  // Most frequent day
  const dayCount: Record<number, number> = {};
  patterns.forEach((p) => {
    dayCount[p.day_of_week] = (dayCount[p.day_of_week] || 0) + p.trip_count;
  });

  const mostFrequentDay = Object.entries(dayCount).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  if (mostFrequentDay) {
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][Number(mostFrequentDay[0])];
    insights.push(`You travel most frequently on ${dayName}s`);
  }

  // Most common time
  const hourCount: Record<number, number> = {};
  patterns.forEach((p) => {
    hourCount[p.hour] = (hourCount[p.hour] || 0) + p.trip_count;
  });

  const mostCommonHour = Object.entries(hourCount).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  if (mostCommonHour) {
    const hour = Number(mostCommonHour[0]);
    const timeSlot = hour < 6 ? "early morning" :
                    hour < 12 ? "morning" :
                    hour < 17 ? "afternoon" :
                    hour < 21 ? "evening" : "night";
    insights.push(`Most of your trips are in the ${timeSlot}`);
  }

  // Vehicle preference
  const vehicleCount: Record<string, number> = {};
  patterns.forEach((p) => {
    vehicleCount[p.most_common_vehicle] = (vehicleCount[p.most_common_vehicle] || 0) + p.trip_count;
  });

  const preferredVehicle = Object.entries(vehicleCount).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  if (preferredVehicle) {
    insights.push(`You prefer ${preferredVehicle[0]} for most trips`);
  }

  // Regularity
  const totalTrips = patterns.reduce((sum, p) => sum + p.trip_count, 0);
  if (totalTrips >= 20) {
    insights.push("You have a regular travel routine");
  }

  return insights;
}

// Record a trip for pattern learning
export async function recordTripPattern(
  supabase: SupabaseClient,
  userId: string,
  tripData: {
    pickupLocation: { lat: number; lng: number };
    dropoffLocation: { lat: number; lng: number };
    vehicleType: string;
    scheduledTime: Date;
  },
): Promise<void> {
  const dayOfWeek = tripData.scheduledTime.getDay();
  const hour = tripData.scheduledTime.getHours();

  await supabase.rpc("upsert_travel_pattern", {
    p_user_id: userId,
    p_day_of_week: dayOfWeek,
    p_hour: hour,
    p_pickup_location: `POINT(${tripData.pickupLocation.lng} ${tripData.pickupLocation.lat})`,
    p_dropoff_location: `POINT(${tripData.dropoffLocation.lng} ${tripData.dropoffLocation.lat})`,
    p_vehicle_type: tripData.vehicleType,
  });
}

// Get next predicted trip
export async function getPredictedNextTrip(
  supabase: SupabaseClient,
  userId: string,
): Promise<PatternPrediction | null> {
  const analysis = await analyzeUserPatterns(supabase, userId, 30);

  if (analysis.predictions.length === 0) {
    return null;
  }

  // Find next upcoming prediction
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  // Sort predictions by proximity to current time
  const sortedPredictions = analysis.predictions.sort((a, b) => {
    const aDiff = Math.abs((a.dayOfWeek - currentDay) * 24 + (a.hour - currentHour));
    const bDiff = Math.abs((b.dayOfWeek - currentDay) * 24 + (b.hour - currentHour));
    return aDiff - bDiff;
  });

  return sortedPredictions[0] || null;
}

// Recommend properties based on user patterns
export async function recommendPropertiesBasedOnPatterns(
  supabase: SupabaseClient,
  userId: string,
  userLocation: { lat: number; lng: number },
): Promise<any[]> {
  // Get user's frequent destinations
  const { data: patterns } = await supabase
    .from("travel_patterns")
    .select("dropoff_location, frequency_count")
    .eq("user_id", userId)
    .order("frequency_count", { ascending: false })
    .limit(3);

  if (!patterns || patterns.length === 0) {
    return [];
  }

  // Search for properties near frequent destinations
  const recommendations = [];
  
  for (const pattern of patterns) {
    // Extract coordinates (would need proper PostGIS parsing)
    // This is simplified
    const { data: properties } = await supabase
      .rpc("search_nearby_properties", {
        p_latitude: userLocation.lat,
        p_longitude: userLocation.lng,
        p_radius_km: 5,
        p_rental_type: null,
        p_bedrooms: null,
        p_min_budget: 0,
        p_max_budget: 999999999,
      })
      .limit(3);

    if (properties) {
      recommendations.push(...properties);
    }
  }

  return recommendations.slice(0, 5);
}

// Calculate optimal schedule time based on patterns
export function calculateOptimalScheduleTime(
  patterns: any[],
  userPreference: { day?: number; hour?: number },
): Date {
  // If user has a preference, start there
  if (userPreference.day !== undefined && userPreference.hour !== undefined) {
    const date = new Date();
    date.setDate(date.getDate() + ((userPreference.day + 7 - date.getDay()) % 7));
    date.setHours(userPreference.hour, 0, 0, 0);
    return date;
  }

  // Otherwise, use most common pattern
  if (patterns.length > 0) {
    const mostCommon = patterns[0];
    const date = new Date();
    date.setDate(date.getDate() + ((mostCommon.day_of_week + 7 - date.getDay()) % 7));
    date.setHours(mostCommon.hour, 0, 0, 0);
    return date;
  }

  // Default to tomorrow at 8 AM
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date;
}

// Detect anomalies in user behavior (potential security issue)
export function detectAnomalies(
  recentTrips: any[],
  historicalPatterns: any[],
): { isAnomaly: boolean; reason?: string } {
  if (historicalPatterns.length < 10) {
    return { isAnomaly: false }; // Not enough data
  }

  // Check for unusual times
  const usualHours = historicalPatterns.map((p) => p.hour);
  const recentHours = recentTrips.map((t) => new Date(t.scheduled_time).getHours());

  const unusualHours = recentHours.filter((h) => !usualHours.includes(h));
  
  if (unusualHours.length > 3) {
    return {
      isAnomaly: true,
      reason: "Trips at unusual times detected",
    };
  }

  return { isAnomaly: false };
}
