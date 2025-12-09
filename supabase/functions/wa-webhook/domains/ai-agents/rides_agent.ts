/**
 * Rides AI Agent - Rebuilt with AI Core
 * Uses Gemini 2.5 Pro for ride matching and transportation services
 */

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { sendText } from "../../wa/client.ts";
import { RouterContext } from "../../types.ts";
import { 
  sendAgentListResponse, 
  sendAgentMessageWithActions, 
  sendAgentMessage,
  AGENT_TEMPLATES,
  formatEmojiNumberedList,
  parseEmojiNumber,
  createQuickReplyInstruction
} from "../../utils/ai-chat-interface.ts";

interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any, context: any) => Promise<any>;
}

/**
 * Rides Agent
 * Transportation matching and ride services
 */
export class RidesAgent {
  private supabase: SupabaseClient;
  private gemini: GoogleGenerativeAI;
  private model: string = 'gemini-2.5-pro-latest';
  private tools: Tool[];
  private instructions: string;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }
    this.gemini = new GoogleGenerativeAI(apiKey);
    
    this.instructions = this.buildInstructions();
    this.tools = this.defineTools();
  }

  private buildInstructions(): string {
    return `You are a transportation assistant for Rwanda. Help users find rides, drivers, and delivery services.

YOUR ROLE:
- Match passengers with drivers
- Help drivers find passengers
- Arrange deliveries and cargo transport
- Provide fare estimates
- Track ride status

RESPONSE FORMAT (CRITICAL):
- ALWAYS use emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) when showing drivers or ride options
- Keep messages concise and conversational
- Use emojis: 🚗, 🏍️, 📍, ⏱️, 💰
- Format driver listings as: "1️⃣ Name - ETA - Vehicle\\n   Additional details"
- End with clear call-to-action

SERVICES:
1. **Passenger Rides**
   - Moto taxi (quick, affordable)
   - Car taxi (comfortable, groups)
   - Shared rides (cost-effective)

2. **Driver Services**
   - Find passengers
   - Route optimization
   - Earnings tracking

3. **Delivery**
   - Package delivery
   - Cargo transport
   - Same-day delivery

GUIDELINES:
- Collect pickup and destination
- Provide fare estimates
- Match based on location and availability
- Prioritize safety and verified drivers
- Track ride status

GUARDRAILS:
- Safety first: only verified drivers
- No guarantees on exact arrival time
- Respect driver and passenger privacy
- Fair pricing based on distance

TOOLS AVAILABLE:
- find_nearby_drivers: Find available drivers nearby
- request_ride: Request a ride
- get_fare_estimate: Calculate fare
- track_ride: Check ride status
- find_passengers: Help drivers find passengers

Always be helpful, safety-focused, and efficient.`;
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'find_nearby_drivers',
        description: 'Find available drivers near a location',
        parameters: {
          type: 'object',
          properties: {
            latitude: { type: 'number', description: 'Pickup latitude' },
            longitude: { type: 'number', description: 'Pickup longitude' },
            vehicle_type: { type: 'string', enum: ['moto', 'car', 'any'] },
            radius_km: { type: 'number', description: 'Search radius in km (default 5)' }
          },
          required: ['latitude', 'longitude']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase.rpc('find_nearby_drivers', {
            lat: params.latitude,
            lng: params.longitude,
            vehicle_filter: params.vehicle_type || 'any',
            radius_km: params.radius_km || 5
          });

          if (error || !data || data.length === 0) {
            return { message: 'No drivers available nearby at the moment.' };
          }

          return {
            count: data.length,
            drivers: data.map((d: any) => ({
              id: d.id,
              name: d.driver_name,
              vehicle_type: d.vehicle_type,
              rating: d.rating,
              distance_km: d.distance_km,
              estimated_arrival: `${Math.ceil(d.distance_km * 3)} minutes`
            }))
          };
        }
      },
      {
        name: 'request_ride',
        description: 'Request a ride from pickup to destination',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            pickup_lat: { type: 'number' },
            pickup_lng: { type: 'number' },
            pickup_address: { type: 'string' },
            destination_lat: { type: 'number' },
            destination_lng: { type: 'number' },
            destination_address: { type: 'string' },
            vehicle_type: { type: 'string', enum: ['moto', 'car'] },
            passengers: { type: 'number', description: 'Number of passengers' }
          },
          required: ['user_id', 'pickup_lat', 'pickup_lng', 'destination_lat', 'destination_lng', 'vehicle_type']
        },
        execute: async (params) => {
          // Calculate distance (simplified - would use actual routing)
          const distance = this.calculateDistance(
            params.pickup_lat,
            params.pickup_lng,
            params.destination_lat,
            params.destination_lng
          );

          // Calculate fare
          const baseFare = params.vehicle_type === 'moto' ? 500 : 1500;
          const perKmRate = params.vehicle_type === 'moto' ? 200 : 500;
          const estimatedFare = baseFare + (distance * perKmRate);

          const { data, error } = await this.supabase
            .from('trips')
            .insert({
              user_id: params.user_id,
              kind: 'request_intent',
              role: 'passenger',
              pickup_lat: params.pickup_lat,
              pickup_lng: params.pickup_lng,
              pickup_text: params.pickup_address,
              dropoff_lat: params.destination_lat,
              dropoff_lng: params.destination_lng,
              dropoff_text: params.destination_address,
              vehicle_type: params.vehicle_type,
              metadata: {
                passengers: params.passengers || 1,
                estimated_fare: Math.round(estimatedFare)
              },
              status: 'open',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to request ride' };
          }

          return {
            ride_id: data.id,
            status: 'pending',
            estimated_fare: `${Math.round(estimatedFare)} RWF`,
            distance_km: distance.toFixed(1),
            message: 'Finding a driver for you...'
          };
        }
      },
      {
        name: 'get_fare_estimate',
        description: 'Calculate fare estimate for a trip',
        parameters: {
          type: 'object',
          properties: {
            pickup_lat: { type: 'number' },
            pickup_lng: { type: 'number' },
            destination_lat: { type: 'number' },
            destination_lng: { type: 'number' },
            vehicle_type: { type: 'string', enum: ['moto', 'car'] }
          },
          required: ['pickup_lat', 'pickup_lng', 'destination_lat', 'destination_lng', 'vehicle_type']
        },
        execute: async (params) => {
          const distance = this.calculateDistance(
            params.pickup_lat,
            params.pickup_lng,
            params.destination_lat,
            params.destination_lng
          );

          const baseFare = params.vehicle_type === 'moto' ? 500 : 1500;
          const perKmRate = params.vehicle_type === 'moto' ? 200 : 500;
          const estimatedFare = baseFare + (distance * perKmRate);
          const estimatedTime = Math.ceil(distance * 3); // 3 min per km average

          return {
            vehicle_type: params.vehicle_type,
            distance_km: distance.toFixed(1),
            estimated_fare: `${Math.round(estimatedFare)} RWF`,
            estimated_time: `${estimatedTime} minutes`,
            breakdown: {
              base_fare: `${baseFare} RWF`,
              distance_charge: `${Math.round(distance * perKmRate)} RWF`
            }
          };
        }
      },
      {
        name: 'track_ride',
        description: 'Track the status of a ride',
        parameters: {
          type: 'object',
          properties: {
            ride_id: { type: 'string' }
          },
          required: ['ride_id']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('trips')
            .select('*, profiles!trips_user_id_fkey(full_name, phone_number, whatsapp_number)')
            .eq('id', params.ride_id)
            .single();

          if (error || !data) {
            return { error: 'Trip not found' };
          }

          const profile = (data as any).profiles || {};
          return {
            trip_id: data.id,
            status: data.status,
            driver: profile ? {
              name: profile.full_name,
              phone: (data as any).drivers.phone,
              vehicle: `${(data as any).drivers.vehicle_type} - ${(data as any).drivers.vehicle_plate}`
            } : null,
            pickup: data.pickup_address,
            destination: data.destination_address,
            fare: `${data.estimated_fare} RWF`
          };
        }
      },
      {
        name: 'find_passengers',
        description: 'Help drivers find nearby passengers',
        parameters: {
          type: 'object',
          properties: {
            driver_id: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            radius_km: { type: 'number', description: 'Search radius (default 5km)' }
          },
          required: ['driver_id', 'latitude', 'longitude']
        },
        execute: async (params) => {
          // Use match_passengers_for_trip_v2 RPC instead of deprecated find_nearby_ride_requests
          // First create a temporary driver trip to enable matching
          const { data: tempTrip, error: tripError } = await this.supabase
            .from('trips')
            .insert({
              user_id: params.driver_id,
              kind: 'request_intent',
              role: 'driver',
              pickup_lat: params.latitude,
              pickup_lng: params.longitude,
              vehicle_type: 'moto', // Default, could be parameterized
              status: 'open'
            })
            .select('id')
            .single();
            
          if (tripError || !tempTrip) {
            return { message: 'Failed to search for passengers. Please try again.' };
          }
          
          const { data, error } = await this.supabase.rpc('match_passengers_for_trip_v2', {
            _trip_id: tempTrip.id,
            _limit: 9,
            _prefer_dropoff: false,
            _radius_m: (params.radius_km || 5) * 1000,
            _window_days: 2
          });

          if (error || !data || data.length === 0) {
            return { message: 'No passenger requests nearby at the moment.' };
          }

          return {
            count: data.length,
            requests: data.map((r: any) => ({
              ride_id: r.id,
              pickup: r.pickup_address,
              destination: r.destination_address,
              distance_km: r.distance_km,
              estimated_fare: `${r.estimated_fare} RWF`
            }))
          };
        }
      }
    ];
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async execute(query: string, context: any): Promise<string> {
    const model = this.gemini.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      }
    });
    
    const geminiTools = [{
      functionDeclarations: this.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
    }];

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: this.instructions }],
        },
        {
          role: "model",
          parts: [{ text: "Hello! I'm your transportation assistant. Where would you like to go?" }],
        }
      ],
      tools: geminiTools as any
    });

    let result = await chat.sendMessage(query);
    const MAX_TURNS = 10;

    for (let i = 0; i < MAX_TURNS; i++) {
      const response = result.response;
      const call = response.functionCalls()?.[0];

      if (call) {
        const toolName = call.name;
        const toolParams = call.args;
        
        const tool = this.tools.find(t => t.name === toolName);
        if (tool) {
          try {
            const toolResult = await tool.execute(toolParams, context);
            
            result = await chat.sendMessage([{
              functionResponse: {
                name: toolName,
                response: toolResult
              }
            }]);
            
          } catch (err) {
            result = await chat.sendMessage([{
              functionResponse: {
                name: toolName,
                response: { error: err instanceof Error ? err.message : String(err) }
              }
            }]);
          }
        } else {
          break;
        }
      } else {
        return response.text();
      }
    }
    
    return result.response.text();
  }
}

export async function runRidesAgent(ctx: RouterContext, query: string) {
  try {
    const agent = new RidesAgent(ctx.supabase);
    const response = await agent.execute(query, { userId: ctx.from });
    await sendText(ctx.from, response);
    return true;
  } catch (error) {
    console.error("RidesAgent error:", error);
    await sendText(ctx.from, "Rides Agent is currently unavailable.");
    return false;
  }
}
