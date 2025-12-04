// ============================================================================
// TRIP LIFECYCLE - SHARED UTILITIES
// ============================================================================
// Common utility functions used across trip lifecycle handlers
// ============================================================================

import type { TripLifecycleContext, TripStatus } from "./types.ts";

const TERMINAL_STATUSES: TripStatus[] = ["completed", "cancelled", "disputed"];

/**
 * Requires profile ID from context, throws if missing
 */
export function requireProfileId(ctx: TripLifecycleContext, operation: string): string {
  if (!ctx.profileId) {
    throw new Error(`${operation}: Profile ID required`);
  }
  return ctx.profileId;
}

/**
 * Validates if a trip status transition is allowed
 */
export function canPerformAction(
  currentStatus: TripStatus,
  targetStatus: TripStatus,
): boolean {
  // Terminal statuses cannot transition
  if (TERMINAL_STATUSES.includes(currentStatus)) {
    return false;
  }

  // Define valid transitions
  const validTransitions: Record<TripStatus, TripStatus[]> = {
    open: ["matched", "cancelled"],
    matched: ["confirmed", "in_progress", "cancelled"],
    confirmed: ["in_progress", "cancelled"],
    in_progress: ["arrived", "completed", "cancelled"],
    arrived: ["picked_up", "cancelled"],
    picked_up: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
    disputed: [],
  };

  return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
}

/**
 * Gets trip by ID with error handling
 */
export async function getTripById(
  ctx: TripLifecycleContext,
  tripId: string,
): Promise<any> {
  const { data: trip, error } = await ctx.supabase
    .from("rides_trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (error || !trip) {
    throw new Error(`Trip not found: ${tripId}`);
  }

  return trip;
}

/**
 * Updates trip status in database
 */
export async function updateTripStatus(
  ctx: TripLifecycleContext,
  tripId: string,
  status: TripStatus,
  additionalUpdates?: Record<string, any>,
): Promise<void> {
  const updates = {
    status,
    updated_at: new Date().toISOString(),
    ...additionalUpdates,
  };

  const { error } = await ctx.supabase
    .from("rides_trips")
    .update(updates)
    .eq("id", tripId);

  if (error) {
    throw new Error(`Failed to update trip status: ${error.message}`);
  }
}
