// Schedule Trip Agent
// Handles trip scheduling, pattern learning, recurring trips, and predictive recommendations

import { serve } from "$std/http/server.ts";
import { createClient } from "@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

interface ScheduleTripRequest {
  userId: string;
  action: "schedule" | "analyze_patterns" | "get_predictions";
  pickupLocation: { latitude: number; longitude: number; address?: string };
  dropoffLocation: { latitude: number; longitude: number; address?: string };
  scheduledTime?: string;
  vehiclePreference?: "Moto" | "Cab" | "Liffan" | "Truck" | "Others";
  recurrence?: "once" | "daily" | "weekdays" | "weekends" | "weekly";
  maxPrice?: number;
  notificationMinutes?: number;
  flexibilityMinutes?: number;
  preferredDrivers?: string[];
  notes?: string;
}

interface TravelPattern {
  dayOfWeek: number;
  hour: number;
  pickupLocation: any;
  dropoffLocation: any;
  vehicleType: string;
  frequency: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startTime = Date.now();

  try {
    const request: ScheduleTripRequest = await req.json();
    
    console.log(JSON.stringify({
      event: "SCHEDULE_TRIP_AGENT_REQUEST",
      timestamp: new Date().toISOString(),
      userId: request.userId,
      action: request.action,
    }));

    switch (request.action) {
      case "schedule":
        return await handleScheduleTrip(supabase, request);
      case "analyze_patterns":
        return await handleAnalyzePatterns(supabase, request.userId);
      case "get_predictions":
        return await handleGetPredictions(supabase, request.userId);
      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: "SCHEDULE_TRIP_AGENT_ERROR",
      error: error.message,
      duration: Date.now() - startTime,
    }));

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleScheduleTrip(supabase: any, request: ScheduleTripRequest) {
  try {
    const scheduledDate = new Date(request.scheduledTime!);
    
    // Create scheduled trip record
    const { data: trip, error } = await supabase
      .from("scheduled_trips")
      .insert({
        user_id: request.userId,
        pickup_location: `POINT(${request.pickupLocation.longitude} ${request.pickupLocation.latitude})`,
        dropoff_location: `POINT(${request.dropoffLocation.longitude} ${request.dropoffLocation.latitude})`,
        pickup_address: request.pickupLocation.address,
        dropoff_address: request.dropoffLocation.address,
        scheduled_time: scheduledDate.toISOString(),
        vehicle_preference: request.vehiclePreference || "Moto",
        recurrence: request.recurrence || "once",
        max_price: request.maxPrice,
        notification_minutes: request.notificationMinutes || 30,
        flexibility_minutes: request.flexibilityMinutes || 15,
        preferred_drivers: request.preferredDrivers || [],
        notes: request.notes,
        is_active: true,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    // Store travel pattern for learning
    await storeravelPattern(supabase, request.userId, {
      dayOfWeek: scheduledDate.getDay(),
      hour: scheduledDate.getHours(),
      pickupLocation: request.pickupLocation,
      dropoffLocation: request.dropoffLocation,
      vehicleType: request.vehiclePreference || "Moto",
    });

    // Get pattern-based predictions
    const predictions = await getPredictionsFromPatterns(supabase, request.userId);

    const recurrenceText = {
      once: "One-time trip",
      daily: "Daily",
      weekdays: "Every weekday",
      weekends: "Every weekend",
      weekly: "Weekly",
    }[request.recurrence || "once"];

    const message = `✅ *Trip Scheduled Successfully!*\n\n` +
      `📅 Schedule: ${recurrenceText}\n` +
      `⏰ Time: ${scheduledDate.toLocaleTimeString()}\n` +
      `📍 From: ${request.pickupLocation.address || "Your location"}\n` +
      `📍 To: ${request.dropoffLocation.address || "Destination"}\n` +
      `🚗 Vehicle: ${request.vehiclePreference || "Moto"}\n` +
      `💰 Max budget: ${request.maxPrice ? request.maxPrice + " RWF" : "Flexible"}\n\n` +
      `I'll notify you ${request.notificationMinutes || 30} minutes before the trip ` +
      `and find the best available driver for you!` +
      (predictions.length > 0 ? `\n\n💡 *Based on your travel patterns, you might also need:*\n${predictions.slice(0, 2).map(p => `• ${p.suggestion}`).join("\n")}` : "");

    return new Response(
      JSON.stringify({
        success: true,
        tripId: trip.id,
        message,
        predictions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw new Error(`Failed to schedule trip: ${error.message}`);
  }
}

async function handleAnalyzePatterns(supabase: any, userId: string) {
  try {
    // Get user's travel patterns from last 30 days
    const { data: patterns, error } = await supabase
      .from("travel_patterns")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!patterns || patterns.length < 5) {
      return new Response(
        JSON.stringify({
          hasPatterns: false,
          message: "Not enough travel history to detect patterns yet. Keep using EasyMO to get personalized recommendations!",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Analyze patterns
    const analysis = {
      mostFrequentRoutes: findFrequentRoutes(patterns),
      typicalTravelTimes: findTypicalTimes(patterns),
      preferredVehicleTypes: findPreferredVehicles(patterns),
      weeklyPattern: analyzeWeeklyPattern(patterns),
    };

    // Use OpenAI to generate insights
    const insights = await generateInsights(patterns, analysis);

    const message = formatPatternAnalysis(analysis, insights);

    return new Response(
      JSON.stringify({
        hasPatterns: true,
        analysis,
        insights,
        message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw new Error(`Failed to analyze patterns: ${error.message}`);
  }
}

async function handleGetPredictions(supabase: any, userId: string) {
  try {
    const predictions = await getPredictionsFromPatterns(supabase, userId);

    if (predictions.length === 0) {
      return new Response(
        JSON.stringify({
          predictions: [],
          message: "No predictions available yet. Keep scheduling trips to get personalized recommendations!",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let message = "🔮 *Predicted Upcoming Trips:*\n\n";
    predictions.slice(0, 3).forEach((pred: any, idx: number) => {
      message += `${idx + 1}. ${pred.suggestion}\n`;
      message += `   📅 ${pred.predictedTime}\n`;
      message += `   🎯 Confidence: ${pred.confidence}%\n\n`;
    });
    message += "Would you like me to schedule any of these trips?";

    return new Response(
      JSON.stringify({
        predictions,
        message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw new Error(`Failed to get predictions: ${error.message}`);
  }
}

async function storeTravelPattern(supabase: any, userId: string, pattern: any) {
  await supabase.from("travel_patterns").insert({
    user_id: userId,
    day_of_week: pattern.dayOfWeek,
    hour: pattern.hour,
    pickup_location: `POINT(${pattern.pickupLocation.longitude} ${pattern.pickupLocation.latitude})`,
    dropoff_location: `POINT(${pattern.dropoffLocation.longitude} ${pattern.dropoffLocation.latitude})`,
    vehicle_type: pattern.vehicleType,
  });
}

async function getPredictionsFromPatterns(supabase: any, userId: string): Promise<any[]> {
  const { data: patterns } = await supabase
    .from("travel_patterns")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (!patterns || patterns.length < 3) return [];

  // Simple pattern-based predictions
  const predictions = [];
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Group by hour and day of week
  const hourPatterns: { [key: string]: number } = {};
  patterns.forEach((p: any) => {
    const key = `${p.day_of_week}-${p.hour}`;
    hourPatterns[key] = (hourPatterns[key] || 0) + 1;
  });

  // Find top patterns
  const sortedPatterns = Object.entries(hourPatterns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  for (const [key, count] of sortedPatterns) {
    const [dayOfWeek, hour] = key.split("-").map(Number);
    
    // Find next occurrence
    let predictedDate = new Date(tomorrow);
    while (predictedDate.getDay() !== dayOfWeek) {
      predictedDate = new Date(predictedDate.getTime() + 24 * 60 * 60 * 1000);
    }
    predictedDate.setHours(hour, 0, 0, 0);

    const confidence = Math.min(95, Math.round((count / patterns.length) * 100));
    
    predictions.push({
      predictedTime: predictedDate.toLocaleString(),
      day: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek],
      hour,
      confidence,
      suggestion: `Trip on ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek]} at ${hour}:00`,
    });
  }

  return predictions;
}

function findFrequentRoutes(patterns: any[]): any[] {
  const routes: { [key: string]: { count: number; example: any } } = {};
  
  patterns.forEach((p) => {
    const key = `${JSON.stringify(p.pickup_location)}-${JSON.stringify(p.dropoff_location)}`;
    if (!routes[key]) {
      routes[key] = { count: 0, example: p };
    }
    routes[key].count++;
  });

  return Object.values(routes)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((r) => ({
      route: "Frequent route",
      frequency: r.count,
      percentage: ((r.count / patterns.length) * 100).toFixed(1),
    }));
}

function findTypicalTimes(patterns: any[]): any[] {
  const timeSlots: { [key: string]: number } = {};
  
  patterns.forEach((p) => {
    const slot = p.hour < 6 ? "early_morning" :
                p.hour < 12 ? "morning" :
                p.hour < 17 ? "afternoon" :
                p.hour < 21 ? "evening" : "night";
    timeSlots[slot] = (timeSlots[slot] || 0) + 1;
  });

  return Object.entries(timeSlots)
    .sort(([, a], [, b]) => b - a)
    .map(([slot, count]) => ({
      timeSlot: slot.replace("_", " "),
      frequency: count,
      percentage: ((count / patterns.length) * 100).toFixed(1),
    }));
}

function findPreferredVehicles(patterns: any[]): any[] {
  const vehicles: { [key: string]: number } = {};
  
  patterns.forEach((p) => {
    vehicles[p.vehicle_type] = (vehicles[p.vehicle_type] || 0) + 1;
  });

  return Object.entries(vehicles)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({
      vehicleType: type,
      frequency: count,
      percentage: ((count / patterns.length) * 100).toFixed(1),
    }));
}

function analyzeWeeklyPattern(patterns: any[]): any[] {
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayPatterns: { [key: number]: number[] } = {};

  patterns.forEach((p) => {
    if (!dayPatterns[p.day_of_week]) {
      dayPatterns[p.day_of_week] = [];
    }
    dayPatterns[p.day_of_week].push(p.hour);
  });

  return Object.entries(dayPatterns).map(([day, hours]) => ({
    day: weekdays[parseInt(day)],
    tripCount: hours.length,
    averageTime: hours.length > 0 ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
  }));
}

async function generateInsights(patterns: any[], analysis: any): Promise<string[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a travel pattern analyst. Generate 3 brief, actionable insights from user travel data.",
          },
          {
            role: "user",
            content: `Analyze these travel patterns and provide insights:\n${JSON.stringify(analysis)}`,
          },
        ],
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    const insights = data.choices[0].message.content.split("\n").filter((s: string) => s.trim());
    return insights.slice(0, 3);
  } catch (error) {
    console.error("Failed to generate AI insights:", error);
    return [
      "You have consistent travel patterns",
      "Consider scheduling recurring trips to save time",
      "Your most active travel days can be predicted",
    ];
  }
}

function formatPatternAnalysis(analysis: any, insights: string[]): string {
  let message = "📊 *Your Travel Pattern Analysis:*\n\n";
  
  if (analysis.mostFrequentRoutes.length > 0) {
    message += "*🛣️ Most Frequent Routes:*\n";
    analysis.mostFrequentRoutes.forEach((route: any, idx: number) => {
      message += `${idx + 1}. Used ${route.frequency} times (${route.percentage}%)\n`;
    });
    message += "\n";
  }

  if (analysis.typicalTravelTimes.length > 0) {
    message += "*⏰ Typical Travel Times:*\n";
    analysis.typicalTravelTimes.forEach((time: any) => {
      message += `• ${time.timeSlot}: ${time.percentage}% of trips\n`;
    });
    message += "\n";
  }

  if (insights.length > 0) {
    message += "*💡 Insights:*\n";
    insights.forEach((insight) => {
      message += `• ${insight}\n`;
    });
  }

  return message;
}
