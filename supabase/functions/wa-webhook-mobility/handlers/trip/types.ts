// ============================================================================
// TRIP LIFECYCLE - SHARED TYPES
// ============================================================================
// Common types and interfaces used across trip lifecycle handlers
// ============================================================================

import type { RouterContext } from "../../types.ts";

export type TripLifecycleContext = RouterContext;

export interface TripStatusUpdate {
  tripId: string;
  status: TripStatus;
  timestamp: Date;
  location?: { lat: number; lng: number };
  notes?: string;
}

export type TripStatus =
  | "open"           // Initial state - looking for match
  | "matched"        // Driver/Passenger matched
  | "confirmed"      // Both parties confirmed
  | "in_progress"    // Trip started
  | "arrived"        // Driver arrived at pickup
  | "picked_up"      // Passenger picked up
  | "completed"      // Trip finished
  | "cancelled"      // Trip cancelled
  | "disputed";      // Dispute raised

export const TRIP_STATUSES: TripStatus[] = [
  "open",
  "matched",
  "confirmed",
  "in_progress",
  "arrived",
  "picked_up",
  "completed",
  "cancelled",
  "disputed",
];

export const TERMINAL_STATUSES: TripStatus[] = ["completed", "cancelled", "disputed"];
