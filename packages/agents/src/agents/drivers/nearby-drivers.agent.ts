/**
 * Nearby Drivers Agent
 * Finds and negotiates with nearby drivers for transportation
 * SLA: 5 minutes, presents 3 options or best available
 */

import { BaseAgent } from '../base/agent.base';
import type { AgentInput, AgentResult, AgentContext, Tool, VendorQuote } from '../../types/agent.types';


interface DriverQuote extends VendorQuote {
  driverId: string;
  driverName: string;
  vehicleType: string;
  vehicleInfo: string;
  rating: number;
  estimatedArrival: number;
  distance: number;
}

export class NearbyDriversAgent extends BaseAgent {
  name = 'nearby_drivers';
  
  instructions = `You are a professional transportation coordinator for EasyMO.
Your role is to:
1. Find nearby drivers matching the requested vehicle type
2. Calculate route distance and estimated time
3. Negotiate fair prices on behalf of passengers
4. Present the top 3 options within 5 minutes
5. Handle booking confirmations

Always be professional, transparent about pricing, and prioritize passenger safety.
Never invent prices - only use actual driver quotes or standard rates.`;

  tools: Tool[] = [
    {
      name: 'find_nearby_drivers',
      description: 'Find drivers near a location',
      parameters: {
        type: 'object',
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          vehicle_type: {
            type: 'string',
            enum: ['Moto', 'Cab', 'Liffan', 'Truck', 'Others']
          },
          radius_km: { type: 'number', default: 10 }
        },
        required: ['latitude', 'longitude', 'vehicle_type']
      },
      execute: async (params, context) => {
        return await this.findNearbyDrivers(params);
      }
    },
    {
      name: 'calculate_route',
      description: 'Calculate route distance and time',
      parameters: {
        type: 'object',
        properties: {
          pickup: { type: 'object' },
          dropoff: { type: 'object' }
        },
        required: ['pickup', 'dropoff']
      },
      execute: async (params, context) => {
        return await this.calculateRoute(params.pickup, params.dropoff);
      }
    },
    {
      name: 'negotiate_price',
      description: 'Negotiate price with driver',
      parameters: {
        type: 'object',
        properties: {
          driver_id: { type: 'string' },
          base_price: { type: 'number' },
          target_price: { type: 'number' }
        },
        required: ['driver_id', 'base_price']
      },
      execute: async (params, context) => {
        return await this.negotiatePrice(params);
      }
    },
    {
      name: 'confirm_booking',
      description: 'Confirm booking with selected driver',
      parameters: {
        type: 'object',
        properties: {
          driver_id: { type: 'string' },
          trip_details: { type: 'object' }
        },
        required: ['driver_id', 'trip_details']
      },
      execute: async (params, context) => {
        return await this.confirmBooking(params, context);
      }
    }
  ];

  async execute(input: AgentInput): Promise<AgentResult> {
    const startTime = Date.now();
    
    // Create session with 5-minute deadline
    const session = this.createSession(input.userId, this.name, 5 * 60 * 1000);

    try {
      // Parse request
      const request = await this.parseRequest(input);
      
      if (!request.pickup || !request.dropoff) {
        return {
          success: false,
          finalOutput: "I need both pickup and dropoff locations to find drivers. Could you please share both locations?",
          toolsInvoked: [],
          duration: Date.now() - startTime,
        };
      }

      // Find nearby drivers
      const drivers = await this.findNearbyDrivers({
        latitude: request.pickup.latitude,
        longitude: request.pickup.longitude,
        vehicle_type: request.vehicleType,
        radius_km: 10
      });

      if (drivers.length === 0) {
        return {
          success: false,
          finalOutput: "No drivers found in your area at the moment. Would you like me to search with a wider radius?",
          toolsInvoked: ['find_nearby_drivers'],
          duration: Date.now() - startTime,
        };
      }

      // Calculate route for each driver
      const driversWithRoutes = await Promise.all(
        drivers.slice(0, 10).map(async (driver) => {
          const route = await this.calculateRoute(request.pickup, request.dropoff);
          return { driver, route };
        })
      );

      // Negotiate with drivers
      const quotes: DriverQuote[] = [];
      
      for (const { driver, route } of driversWithRoutes) {
        const basePrice = this.calculateBasePrice(route.distance, request.vehicleType);
        const negotiation = await this.negotiatePrice({
          driver_id: driver.id,
          base_price: basePrice,
          target_price: basePrice * 0.9 // Try for 10% discount
        });

        if (negotiation.accepted) {
          const quote: DriverQuote = {
            vendorId: driver.id,
            vendorName: driver.name,
            vendorType: 'driver',
            driverId: driver.id,
            driverName: driver.name,
            vehicleType: driver.vehicle_type,
            vehicleInfo: driver.vehicle_info,
            rating: driver.rating,
            offer: {
              price: negotiation.final_price,
              currency: 'RWF',
              eta: route.duration + driver.distance_to_pickup,
              distance: route.distance,
              notes: negotiation.notes
            },
            estimatedArrival: driver.distance_to_pickup / 0.5, // Assuming 30 km/h average
            distance: driver.distance_to_pickup,
            score: 0,
            timestamp: Date.now()
          };

          // Calculate score for ranking
          quote.score = this.calculateScore(quote, request);
          
          quotes.push(quote);
          this.addResult(session, quote);

          // Stop if we have 3 options
          if (quotes.length >= 3) {
            break;
          }
        }
      }

      // Sort by score
      quotes.sort((a, b) => b.score - a.score);

      // Complete session
      this.completeSession(session);

      return {
        success: true,
        finalOutput: this.formatOptions(quotes),
        data: {
          quotes,
          sessionId: session.id
        },
        toolsInvoked: ['find_nearby_drivers', 'calculate_route', 'negotiate_price'],
        duration: Date.now() - startTime,
        options: quotes,
        requiresConfirmation: true
      };

    } catch (error) {
      console.error('NearbyDriversAgent error:', error);
      return {
        success: false,
        finalOutput: "I encountered an error while searching for drivers. Please try again.",
        toolsInvoked: [],
        duration: Date.now() - startTime,
      };
    }
  }

  private async parseRequest(input: AgentInput): Promise<any> {
    // TODO: Use OpenAI to parse natural language request
    const metadata = input.metadata || input.context?.metadata || {};
    return {
      pickup: input.location,
      dropoff: metadata.destination,
      vehicleType: metadata.vehicleType || 'Moto'
    };
  }

  private async findNearbyDrivers(params: any): Promise<any[]> {
    // TODO: Query Supabase for nearby drivers
    // For now, return mock data
    return [
      {
        id: 'driver-1',
        name: 'Jean Claude',
        vehicle_type: params.vehicle_type,
        vehicle_info: 'Toyota RAV4 2020',
        rating: 4.8,
        distance_to_pickup: 2.5,
        status: 'available'
      },
      {
        id: 'driver-2',
        name: 'Marie Uwase',
        vehicle_type: params.vehicle_type,
        vehicle_info: 'Honda CRV 2019',
        rating: 4.9,
        distance_to_pickup: 3.2,
        status: 'available'
      },
      {
        id: 'driver-3',
        name: 'Patrick Niyonkuru',
        vehicle_type: params.vehicle_type,
        vehicle_info: 'Toyota Corolla 2021',
        rating: 4.7,
        distance_to_pickup: 1.8,
        status: 'available'
      }
    ];
  }

  private async calculateRoute(pickup: any, dropoff: any): Promise<any> {
    // TODO: Use Google Maps API or similar
    return {
      distance: 15.5, // km
      duration: 25, // minutes
      route: []
    };
  }

  private calculateBasePrice(distance: number, vehicleType: string): number {
    const basePrices: Record<string, number> = {
      'Moto': 500,
      'Cab': 1000,
      'Liffan': 800,
      'Truck': 2000,
      'Others': 700
    };

    const perKmPrices: Record<string, number> = {
      'Moto': 100,
      'Cab': 200,
      'Liffan': 150,
      'Truck': 400,
      'Others': 150
    };

    return basePrices[vehicleType] + (distance * perKmPrices[vehicleType]);
  }

  private async negotiatePrice(params: any): Promise<any> {
    // TODO: Implement actual negotiation logic via WhatsApp
    // For now, simulate negotiation
    const acceptProbability = Math.random();
    
    if (acceptProbability > 0.3) {
      const discount = Math.random() * 0.1; // 0-10% discount
      return {
        accepted: true,
        final_price: Math.round(params.base_price * (1 - discount)),
        notes: discount > 0.05 ? 'Negotiated price' : 'Standard rate'
      };
    }

    return {
      accepted: false,
      reason: 'Driver unavailable'
    };
  }

  private async confirmBooking(params: any, context: AgentContext): Promise<any> {
    // TODO: Create booking in database
    return {
      booking_id: `booking_${Date.now()}`,
      status: 'confirmed',
      driver_id: params.driver_id,
      trip_details: params.trip_details
    };
  }

  protected formatSingleOption(option: any): string {
    let formatted = `👤 Driver: ${option.driverName}\n`;
    formatted += `⭐ Rating: ${option.rating}/5\n`;
    formatted += `🚗 Vehicle: ${option.vehicleInfo}\n`;
    formatted += `💰 Price: ${option.offer.price} ${option.offer.currency}\n`;
    formatted += `⏱️ Arrival: ~${Math.round(option.estimatedArrival)} mins\n`;
    formatted += `📍 Distance: ${option.distance.toFixed(1)}km away\n`;
    if (option.offer.notes) {
      formatted += `📝 ${option.offer.notes}\n`;
    }
    return formatted;
  }

  protected calculateScore(option: any, criteria: any): number {
    let score = 0;

    // Rating (40%)
    score += (option.rating / 5) * 40;

    // Price (30%) - lower is better
    const avgPrice = 5000; // Assume average trip price
    const priceScore = Math.max(0, 30 - ((option.offer.price - avgPrice) / avgPrice) * 30);
    score += priceScore;

    // Distance (20%) - closer is better
    const distanceScore = Math.max(0, 20 - (option.distance / 10) * 20);
    score += distanceScore;

    // ETA (10%) - faster is better
    const etaScore = Math.max(0, 10 - (option.estimatedArrival / 30) * 10);
    score += etaScore;

    return Math.round(score);
  }
}
