/**
 * Mobility Agent - EasyMO ride booking and trip management
 * Handles driver matching, route optimization, fare calculation
 */

import { AgentExecutor } from '../agent-executor';
import { TOOL_DEFINITIONS } from '../tools/registry';

const MOBILITY_SYSTEM_PROMPT = `You are EasyMO's Mobility Assistant, an expert in ride booking and transportation.

Your responsibilities:
- Help users find and book rides (moto, car, delivery)
- Match riders with nearby available drivers
- Calculate optimal routes and accurate fares
- Provide real-time trip updates and ETAs
- Handle trip modifications and cancellations
- Answer questions about driver ratings and vehicle types

Available tools:
- google_maps: Find nearby drivers, calculate routes, estimate distances
- database_query: Check driver availability, trip history, pricing
- search_grounding: Get real-time traffic or weather updates

Be friendly, efficient, and prioritize user safety. Always verify locations before booking.`;

export class MobilityAgent extends AgentExecutor {
  constructor() {
    super({
      model: 'gpt-4o-mini',
      systemPrompt: MOBILITY_SYSTEM_PROMPT,
      tools: ['google_maps', 'database_query', 'search_grounding'],
      maxIterations: 5,
    });
  }

  /**
   * Find nearby drivers for a specific vehicle type
   */
  async findNearbyDrivers(params: {
    location: { lat: number; lng: number };
    vehicleType: 'moto' | 'car' | 'delivery';
    radius?: number;
  }) {
    const query = `Find available ${params.vehicleType} drivers within ${params.radius || 3000}m of coordinates ${params.location.lat}, ${params.location.lng}. Return driver IDs, distances, and ETAs.`;
    return this.execute(query);
  }

  /**
   * Calculate trip fare and route
   */
  async calculateTripQuote(params: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    vehicleType: 'moto' | 'car' | 'delivery';
  }) {
    const query = `Calculate fare and route for a ${params.vehicleType} trip from [${params.origin.lat}, ${params.origin.lng}] to [${params.destination.lat}, ${params.destination.lng}]. Include distance, duration, and estimated cost.`;
    return this.execute(query);
  }

  /**
   * Book a ride with specified driver
   */
  async bookRide(params: {
    driverId: string;
    origin: { lat: number; lng: number; address?: string };
    destination: { lat: number; lng: number; address?: string };
    userId: string;
    vehicleType: string;
  }) {
    const query = `Book a ride: Driver ${params.driverId}, User ${params.userId}, from ${params.origin.address || `[${params.origin.lat}, ${params.origin.lng}]`} to ${params.destination.address || `[${params.destination.lat}, ${params.destination.lng}]`}. Vehicle type: ${params.vehicleType}. Confirm booking and provide trip ID.`;
    return this.execute(query);
  }

  /**
   * Get trip status and ETA
   */
  async getTripStatus(tripId: string) {
    const query = `Get current status for trip ${tripId}. Include driver location, ETA, and trip progress.`;
    return this.execute(query);
  }

  /**
   * Natural language trip booking
   */
  async bookRideNaturalLanguage(message: string) {
    return this.execute(message);
  }
}

export const mobilityAgent = new MobilityAgent();
