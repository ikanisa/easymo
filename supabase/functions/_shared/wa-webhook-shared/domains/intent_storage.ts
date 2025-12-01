// Mobility Intent Storage - Enhanced intent tracking for recommendations
// Stores user intents in dedicated table instead of profiles.metadata

import type { SupabaseClient } from "../deps.ts";

export type IntentType = 'nearby_drivers' | 'nearby_passengers' | 'schedule' | 'go_online';
export type RecurrenceType = 'once' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

interface SaveIntentParams {
  userId: string;
  intentType: IntentType;
  vehicleType: string;
  pickup: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  scheduledFor?: Date;
  recurrence?: RecurrenceType;
  expiresInMinutes?: number;
}

/**
 * Save user intent to mobility_intents table for better querying and recommendations
 */
export async function saveIntent(
  client: SupabaseClient,
  params: SaveIntentParams,
): Promise<string> {
  const expiresInMinutes = params.expiresInMinutes ?? 30;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  const { data, error } = await client
    .from("mobility_intents")
    .insert({
      user_id: params.userId,
      intent_type: params.intentType,
      vehicle_type: params.vehicleType,
      pickup_lat: params.pickup.lat,
      pickup_lng: params.pickup.lng,
      dropoff_lat: params.dropoff?.lat ?? null,
      dropoff_lng: params.dropoff?.lng ?? null,
      scheduled_for: params.scheduledFor?.toISOString() ?? null,
      recurrence: params.recurrence ?? null,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();
    
  if (error) throw error;
  return data.id;
}

/**
 * Get recent intents for a user
 */
export async function getRecentIntents(
  client: SupabaseClient,
  userId: string,
  intentType?: IntentType,
  limit = 10,
) {
  let query = client
    .from("mobility_intents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
    
  if (intentType) {
    query = query.eq("intent_type", intentType);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Clean up expired intents (can be called periodically or via cron)
 */
export async function cleanupExpiredIntents(
  client: SupabaseClient,
): Promise<number> {
  const { data, error } = await client
    .from("mobility_intents")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("id");
    
  if (error) throw error;
  return data?.length ?? 0;
}
