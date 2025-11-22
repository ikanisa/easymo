import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { t } from "../../i18n/translator.ts";
import { sendText } from "../../wa/client.ts";
import { RouterContext } from "../../types.ts";

interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any, context: any) => Promise<any>;
}

export class BusinessBrokerAgent {
  name = 'business_broker_agent';
  instructions = `You are a local business discovery agent for Rwanda. Map user needs → business categories → specific nearby businesses. 
  
  Process:
  1. Understand user intent (e.g., "I need a plumber", "Where is the nearest pharmacy?").
  2. If location is not provided, ask for it.
  3. Use 'maps_geocode' to convert location name to coordinates if needed.
  4. Use 'search_businesses' to find businesses in the database.
  5. Return a short, ranked list with reasons (open now, distance, rating).
  
  Guardrails:
  - Only recommend businesses from the database.
  - Respect opening hours.
  - No medical advice beyond finding a facility.
  - Provide phone numbers so users can contact them.`;

  tools: Tool[];
  private supabase: SupabaseClient;
  private gemini: GoogleGenerativeAI;
  private model: string = 'gemini-1.5-flash';

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }
    this.gemini = new GoogleGenerativeAI(apiKey);
    this.tools = this.defineTools();
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_businesses',
        description: 'Find businesses by location and category. Returns sorted list with distance.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Business category (e.g., pharmacy, restaurant)' },
            lat: { type: 'number', description: 'Latitude' },
            lng: { type: 'number', description: 'Longitude' },
            radius_km: { type: 'number', description: 'Search radius in km (default 5)' },
            limit: { type: 'number', description: 'Max results (default 5)' }
          },
          required: ['category', 'lat', 'lng']
        },
        execute: async (params: any) => {
          const { category, lat, lng, radius_km = 5, limit = 5 } = params;
          
          const { data, error } = await this.supabase.rpc('search_businesses_nearby', {
            p_category: category,
            p_lat: lat,
            p_lng: lng,
            p_radius_meters: radius_km * 1000,
            p_limit: limit
          });

          if (error) {
            console.error("RPC search_businesses_nearby failed:", error);
            // Fallback
            const { data: fallbackData } = await this.supabase
              .from('business_directory')
              .select('*')
              .ilike('category', `%${category}%`)
              .limit(limit);
            return { businesses: fallbackData || [] };
          }

          return { businesses: data };
        }
      },
      {
        name: 'maps_geocode',
        description: 'Convert address or place name to coordinates (lat/lng).',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string' }
          },
          required: ['address']
        },
        execute: async (params: any) => {
          const { address } = params;
          const apiKey = Deno.env.get("SERPAPI_KEY");
          
          if (!apiKey) return { error: "SerpApi Key missing" };

          try {
            const url = new URL('https://serpapi.com/search');
            url.searchParams.append('engine', 'google_maps');
            url.searchParams.append('q', `${address}, Rwanda`);
            url.searchParams.append('api_key', apiKey);
            url.searchParams.append('type', 'search');
            url.searchParams.append('hl', 'en');
            url.searchParams.append('gl', 'rw');

            const response = await fetch(url.toString());
            const data = await response.json();

            const result = data.local_results?.[0] || data.place_results;
            
            if (result?.gps_coordinates) {
              return {
                lat: result.gps_coordinates.latitude,
                lng: result.gps_coordinates.longitude,
                formatted_address: result.address || result.title
              };
            }
            return { error: "Location not found" };
          } catch (error) {
            console.error("Geocode error:", error);
            return { error: "Geocoding failed" };
          }
        }
      }
    ];
  }

  async execute(query: string, userId: string): Promise<string> {
    const model = this.gemini.getGenerativeModel({ model: this.model });
    
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
          parts: [{ text: "Understood. I am ready to help users find businesses in Rwanda." }],
        }
      ],
      tools: geminiTools as any
    });

    let result = await chat.sendMessage(query);
    const MAX_TURNS = 5;

    for (let i = 0; i < MAX_TURNS; i++) {
      const response = result.response;
      const call = response.functionCalls()?.[0];

      if (call) {
        const toolName = call.name;
        const toolParams = call.args;
        
        const tool = this.tools.find(t => t.name === toolName);
        if (tool) {
          try {
            const toolResult = await tool.execute(toolParams, { userId });
            
            // Send tool result back
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
          break; // Tool not found
        }
      } else {
        return response.text();
      }
    }
    
    return result.response.text();
  }
}

// Helper to run the agent
export async function runBusinessBrokerAgent(ctx: RouterContext, query: string) {
  try {
    const agent = new BusinessBrokerAgent(ctx.supabase);
    const response = await agent.execute(query, ctx.from);
    await sendText(ctx.from, response);
    return true;
  } catch (error) {
    console.error("BusinessBrokerAgent error:", error);
    await sendText(ctx.from, "I'm having trouble connecting to the business directory. Please try again later.");
    return false;
  }
}
