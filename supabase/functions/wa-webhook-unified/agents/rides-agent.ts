/**
 * Rides Agent
 * 
 * Transport and ride-sharing assistant.
 * Connects drivers with passengers and manages trip scheduling.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool } from "../core/types.ts";

export class RidesAgent extends BaseAgent {
  get type(): AgentType {
    return "rides";
  }

  get keywords(): string[] {
    return [
      "ride", "driver", "passenger", "transport", "pick", "drop",
      "take me", "going to", "trip", "travel", "taxi", "moto", "car"
    ];
  }

  get systemPrompt(): string {
    return `You are EasyMO Rides Agent, helping with transport and ride-sharing in Rwanda.

YOUR CAPABILITIES:
- Help passengers find drivers
- Help drivers find passengers
- Schedule trips
- Manage recurring trips
- Provide fare estimates

PASSENGER FLOW:
- Ask for pickup location
- Ask for destination
- Ask for departure time (now or scheduled)
- Search for available drivers
- Connect passenger with driver

DRIVER FLOW:
- Ask for route (from → to)
- Ask for departure time
- Ask for available seats
- Search for passengers
- Connect driver with passengers

SCHEDULING:
- Support immediate rides
- Support scheduled trips
- Support recurring trips (daily, weekly)
- Send reminders

RULES:
- Always confirm locations
- Provide fare estimates
- Respect time preferences
- Prioritize safety
- Clear communication

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "find_driver|find_passenger|schedule_trip|cancel_trip|inquiry|unclear",
  "extracted_entities": {
    "pickup_location": "string or null",
    "dropoff_location": "string or null",
    "departure_time": "string or null",
    "seats_needed": "number or null",
    "seats_available": "number or null"
  },
  "next_action": "ask_pickup|ask_dropoff|ask_time|search_drivers|search_passengers|confirm_trip|continue",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "search_drivers",
        description: "Search for available drivers",
        parameters: {
          type: "object",
          properties: {
            pickup_location: { type: "string", description: "Pickup location" },
            dropoff_location: { type: "string", description: "Destination" },
            departure_time: { type: "string", description: "When to depart" },
          },
          required: ["pickup_location", "dropoff_location"],
        },
      },
      {
        name: "search_passengers",
        description: "Search for passengers",
        parameters: {
          type: "object",
          properties: {
            route_from: { type: "string", description: "Starting point" },
            route_to: { type: "string", description: "Destination" },
            seats_available: { type: "number", description: "Seats available" },
          },
          required: ["route_from", "route_to"],
        },
      },
      {
        name: "estimate_fare",
        description: "Estimate trip fare",
        parameters: {
          type: "object",
          properties: {
            distance_km: { type: "number", description: "Distance in km" },
          },
          required: ["distance_km"],
        },
      },
    ];
  }

  protected async executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    switch (toolName) {
      case "search_drivers":
        return await this.searchDrivers(parameters);
      case "search_passengers":
        return await this.searchPassengers(parameters);
      case "estimate_fare":
        return this.estimateFare(parameters.distance_km);
      default:
        return null;
    }
  }

  private async searchDrivers(params: Record<string, any>) {
    // Would search actual driver database
    return { drivers: [], message: "No drivers found at the moment" };
  }

  private async searchPassengers(params: Record<string, any>) {
    // Would search actual passenger requests
    return { passengers: [], message: "No passengers found for this route" };
  }

  private estimateFare(distanceKm: number) {
    const baseRate = 500; // RWF
    const perKmRate = 200; // RWF per km
    const fare = baseRate + (distanceKm * perKmRate);
    return { fare, currency: "RWF", distance_km: distanceKm };
  }
}
