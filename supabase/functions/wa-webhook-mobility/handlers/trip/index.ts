// ============================================================================
// TRIP LIFECYCLE - INDEX (Re-exports)
// ============================================================================
// This file re-exports all trip lifecycle functions for cleaner imports
// Full refactoring to split handlers is planned for Phase 2
// ============================================================================

export {
  type TripLifecycleContext,
  type TripStatusUpdate,
  type TripStatus,
  handleTripStart,
  handleTripArrivedAtPickup,
  handleTripPickedUp,
  handleTripComplete,
  handleTripCancel,
  handleTripRating,
  handleTripRate,
  getTripStatus,
  canPerformAction,
} from "../trip_lifecycle.ts";

export default {
  handleTripStart,
  handleTripArrivedAtPickup,
  handleTripPickedUp,
  handleTripComplete,
  handleTripCancel,
  handleTripRating,
  handleTripRate,
  getTripStatus,
  canPerformAction,
};
