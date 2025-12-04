/**
 * Mobility Agent Base Class
 *
 * Base class for all mobility/transportation agents including:
 * - Rides Agent (taxi, ride-sharing)
 * - Shuttle/Bus services
 * - Delivery services
 *
 * Provides common mobility functionality:
 * - Location services
 * - Driver matching
 * - Booking management
 * - Ride tracking
 *
 * @packageDocumentation
 */

import { AgentBase, AgentConfig, AgentInput, AgentResult } from '../core/agent-base.js';
import type { Tool, ToolContext } from '../types/index.js';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Geographic location
 */
export interface Location {
  /** Latitude */
  latitude: number;
  /** Longitude */
  longitude: number;
  /** Address string */
  address?: string;
  /** Place name */
  placeName?: string;
}

/**
 * Driver information
 */
export interface Driver {
  /** Driver ID */
  id: string;
  /** Driver name */
  name: string;
  /** Phone number */
  phone?: string;
  /** Vehicle info */
  vehicle: Vehicle;
  /** Current location */
  location: Location;
  /** Distance from pickup (meters) */
  distance: number;
  /** ETA to pickup (minutes) */
  eta: number;
  /** Driver rating */
  rating?: number;
}

/**
 * Vehicle information
 */
export interface Vehicle {
  /** Vehicle ID */
  id: string;
  /** Make (e.g., Toyota) */
  make: string;
  /** Model (e.g., Corolla) */
  model: string;
  /** License plate */
  licensePlate: string;
  /** Vehicle color */
  color: string;
  /** Vehicle type */
  type: VehicleType;
  /** Passenger capacity */
  capacity: number;
}

/**
 * Vehicle type
 */
export type VehicleType = 'car' | 'motorcycle' | 'shuttle' | 'van' | 'truck';

/**
 * Trip request
 */
export interface TripRequest {
  /** Pickup location */
  pickup: Location;
  /** Dropoff location */
  dropoff: Location;
  /** Requested pickup time */
  pickupTime?: Date;
  /** Number of passengers */
  passengers: number;
  /** Vehicle type preference */
  vehicleType?: VehicleType;
  /** Special notes */
  notes?: string;
}

/**
 * Booking information
 */
export interface Booking {
  /** Booking ID */
  id: string;
  /** Customer ID */
  customerId: string;
  /** Driver assigned */
  driver?: Driver;
  /** Trip details */
  trip: TripRequest;
  /** Estimated fare */
  estimatedFare: number;
  /** Currency */
  currency: string;
  /** Booking status */
  status: BookingStatus;
  /** Created timestamp */
  createdAt: Date;
  /** Scheduled pickup time */
  scheduledTime?: Date;
}

/**
 * Booking status
 */
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'driver_assigned'
  | 'driver_en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/**
 * Ride status for tracking
 */
export interface RideStatus {
  /** Current status */
  status: BookingStatus;
  /** Driver location */
  driverLocation?: Location;
  /** ETA to destination (minutes) */
  eta?: number;
  /** Distance remaining (meters) */
  distanceRemaining?: number;
  /** Last updated */
  updatedAt: Date;
}

/**
 * Fare estimate
 */
export interface FareEstimate {
  /** Base fare */
  baseFare: number;
  /** Distance-based fare */
  distanceFare: number;
  /** Time-based fare */
  timeFare: number;
  /** Surge multiplier */
  surgeMultiplier: number;
  /** Total estimated fare */
  total: number;
  /** Currency */
  currency: string;
  /** Estimated duration (minutes) */
  estimatedDuration: number;
  /** Estimated distance (meters) */
  estimatedDistance: number;
}

// ============================================================================
// MOBILITY AGENT BASE CLASS
// ============================================================================

/**
 * Base class for mobility/transportation agents
 *
 * Provides common functionality for rides, shuttles, and delivery agents.
 */
export abstract class MobilityAgentBase extends AgentBase {
  // Mobility-specific tools - to be populated by subclasses
  protected locationTools: Tool[] = [];
  protected bookingTools: Tool[] = [];
  protected trackingTools: Tool[] = [];

  constructor(config?: AgentConfig) {
    super(config);
  }

  /**
   * Default execute implementation using ReAct pattern
   */
  async execute(input: AgentInput): Promise<AgentResult> {
    this.log('MOBILITY_EXECUTE_START', {
      userId: input.userId,
      conversationId: input.conversationId,
    });

    // Load memory
    const memoryContext = await this.loadMemory(
      input.userId,
      input.conversationId,
      input.message,
    );

    // Build messages
    const messages = this.buildMessages(input, memoryContext);

    // Create context
    const context = {
      userId: input.userId,
      conversationId: input.conversationId,
      agentName: this.name,
      variables: input.context,
      correlationId: this.correlationId,
    };

    // Execute with ReAct pattern
    const result = await this.executeReAct(messages, context);

    // Save to memory
    await this.saveMemory(
      input.userId,
      input.conversationId,
      input.message,
      result.message,
    );

    return result;
  }

  // ========================================================================
  // MOBILITY-SPECIFIC METHODS
  // ========================================================================

  /**
   * Find nearby drivers
   */
  protected async findNearbyDrivers(
    location: Location,
    vehicleType?: VehicleType,
    context?: ToolContext,
  ): Promise<Driver[]> {
    this.log('FIND_NEARBY_DRIVERS', {
      location: location.address,
      vehicleType,
    });

    try {
      const drivers = await this.doFindNearbyDrivers(location, vehicleType, context);

      this.log('FIND_NEARBY_DRIVERS_RESULT', { count: drivers.length });
      return drivers;
    } catch (error) {
      this.log('FIND_NEARBY_DRIVERS_ERROR', { error: String(error) });
      return [];
    }
  }

  /**
   * Create a booking
   */
  protected async createBooking(
    trip: TripRequest,
    customerId: string,
    context?: ToolContext,
  ): Promise<Booking | null> {
    this.log('CREATE_BOOKING', {
      pickup: trip.pickup.address,
      dropoff: trip.dropoff.address,
      customerId,
    });

    try {
      // Get fare estimate first
      const fareEstimate = await this.estimateFare(trip, context);

      // Create booking
      const booking = await this.doCreateBooking(
        trip,
        customerId,
        fareEstimate,
        context,
      );

      this.log('CREATE_BOOKING_SUCCESS', { bookingId: booking.id });
      return booking;
    } catch (error) {
      this.log('CREATE_BOOKING_ERROR', { error: String(error) });
      return null;
    }
  }

  /**
   * Track a ride
   */
  protected async trackRide(
    bookingId: string,
    context?: ToolContext,
  ): Promise<RideStatus | null> {
    this.log('TRACK_RIDE', { bookingId });

    try {
      const status = await this.doTrackRide(bookingId, context);
      this.log('TRACK_RIDE_RESULT', {
        bookingId,
        status: status.status,
      });
      return status;
    } catch (error) {
      this.log('TRACK_RIDE_ERROR', { error: String(error) });
      return null;
    }
  }

  /**
   * Estimate fare for a trip
   */
  protected async estimateFare(
    trip: TripRequest,
    context?: ToolContext,
  ): Promise<FareEstimate> {
    this.log('ESTIMATE_FARE', {
      pickup: trip.pickup.address,
      dropoff: trip.dropoff.address,
    });

    try {
      const estimate = await this.doEstimateFare(trip, context);
      this.log('ESTIMATE_FARE_RESULT', {
        total: estimate.total,
        duration: estimate.estimatedDuration,
      });
      return estimate;
    } catch (error) {
      this.log('ESTIMATE_FARE_ERROR', { error: String(error) });
      // Return default estimate on error
      return {
        baseFare: 0,
        distanceFare: 0,
        timeFare: 0,
        surgeMultiplier: 1,
        total: 0,
        currency: 'RWF',
        estimatedDuration: 0,
        estimatedDistance: 0,
      };
    }
  }

  /**
   * Cancel a booking
   */
  protected async cancelBooking(
    bookingId: string,
    reason: string,
    context?: ToolContext,
  ): Promise<boolean> {
    this.log('CANCEL_BOOKING', { bookingId, reason });

    try {
      const success = await this.doCancelBooking(bookingId, reason, context);
      this.log('CANCEL_BOOKING_RESULT', { bookingId, success });
      return success;
    } catch (error) {
      this.log('CANCEL_BOOKING_ERROR', { error: String(error) });
      return false;
    }
  }

  /**
   * Geocode an address to coordinates
   */
  protected async geocodeAddress(
    address: string,
    context?: ToolContext,
  ): Promise<Location | null> {
    try {
      const location = await this.doGeocodeAddress(address, context);
      return location;
    } catch (error) {
      this.log('GEOCODE_ERROR', { address, error: String(error) });
      return null;
    }
  }

  /**
   * Calculate distance between two locations (meters)
   */
  protected calculateDistance(from: Location, to: Location): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Format ETA for display
   */
  protected formatETA(minutes: number): string {
    if (minutes < 1) {
      return 'Less than 1 minute';
    } else if (minutes === 1) {
      return '1 minute';
    } else if (minutes < 60) {
      return `${Math.round(minutes)} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      if (mins === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      }
      return `${hours} hour${hours > 1 ? 's' : ''} ${mins} min`;
    }
  }

  /**
   * Format distance for display
   */
  protected formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  // ========================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ========================================================================

  /**
   * Find nearby drivers implementation
   */
  protected abstract doFindNearbyDrivers(
    location: Location,
    vehicleType?: VehicleType,
    context?: ToolContext,
  ): Promise<Driver[]>;

  /**
   * Create booking implementation
   */
  protected abstract doCreateBooking(
    trip: TripRequest,
    customerId: string,
    fareEstimate: FareEstimate,
    context?: ToolContext,
  ): Promise<Booking>;

  /**
   * Track ride implementation
   */
  protected abstract doTrackRide(
    bookingId: string,
    context?: ToolContext,
  ): Promise<RideStatus>;

  /**
   * Estimate fare implementation
   */
  protected abstract doEstimateFare(
    trip: TripRequest,
    context?: ToolContext,
  ): Promise<FareEstimate>;

  /**
   * Cancel booking implementation
   */
  protected abstract doCancelBooking(
    bookingId: string,
    reason: string,
    context?: ToolContext,
  ): Promise<boolean>;

  /**
   * Geocode address implementation
   */
  protected abstract doGeocodeAddress(
    address: string,
    context?: ToolContext,
  ): Promise<Location | null>;
}
