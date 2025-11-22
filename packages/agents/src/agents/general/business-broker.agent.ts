import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { BaseAgent } from '../base/agent.base';
import type { AgentInput, AgentResult, Tool } from '../../types/agent.types';

export class BusinessBrokerAgent extends BaseAgent {
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

  constructor() {
    super();
    this.tools = this.defineTools();
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase credentials missing for BusinessBrokerAgent");
    }
    
    this.supabase = createClient(supabaseUrl || '', supabaseKey || '', {
      auth: { persistSession: false }
    });
    
    // Set model to Gemini
    this.model = 'gemini-1.5-flash';
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
        execute: async (params, context) => {
          const { category, lat, lng, radius_km = 5, limit = 5 } = params;
          
          // Use PostGIS ST_DWithin for efficient location search
          const { data, error } = await this.supabase.rpc('search_businesses_nearby', {
            p_category: category,
            p_lat: lat,
            p_lng: lng,
            p_radius_meters: radius_km * 1000,
            p_limit: limit
          });

          if (error) {
            // Fallback to simple query if RPC fails or doesn't exist yet
            console.error("RPC search_businesses_nearby failed:", error);
            const { data: fallbackData, error: fallbackError } = await this.supabase
              .from('business_directory')
              .select('*')
              .ilike('category', `%${category}%`)
              .limit(limit);
              
            if (fallbackError) throw new Error(`Search failed: ${fallbackError.message}`);
            return { businesses: fallbackData };
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
        execute: async (params, context) => {
          const { address } = params;
          const apiKey = process.env.SERPAPI_KEY;
          
          if (!apiKey) throw new Error("SerpApi Key missing");

          try {
            const response = await axios.get('https://serpapi.com/search', {
              params: {
                engine: 'google_maps',
                q: `${address}, Rwanda`, // Contextualize to Rwanda
                api_key: apiKey,
                type: 'search',
                hl: 'en',
                gl: 'rw'
              }
            });

            const result = response.data.local_results?.[0] || response.data.place_results;
            
            if (result?.gps_coordinates) {
              return {
                lat: result.gps_coordinates.latitude,
                lng: result.gps_coordinates.longitude,
                formatted_address: result.address || result.title
              };
            }
            
            // Fallback check for simple lat/lng in other fields
            return { error: "Location not found" };
          } catch (error) {
            console.error("Geocode error:", error);
            return { error: "Geocoding failed" };
          }
        }
      },
      {
        name: 'business_details',
        description: 'Fetch full details for a specific business by ID.',
        parameters: {
          type: 'object',
          properties: {
            business_id: { type: 'string' }
          },
          required: ['business_id']
        },
        execute: async (params, context) => {
          const { data, error } = await this.supabase
            .from('business_directory')
            .select('*')
            .eq('id', params.business_id)
            .single();

          if (error) throw new Error(`Fetch details failed: ${error.message}`);
          return data;
        }
      }
    ];
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    const startTime = Date.now();
    const context = input.context ?? { userId: input.userId };
    
    // 1. System Prompt
    const messages: any[] = [
      { role: 'system', content: this.instructions },
      { role: 'user', content: input.query }
    ];

    // 2. LLM Call (Loop for tool use)
    let finalOutput = "";
    let toolsInvoked: string[] = [];
    const MAX_TURNS = 5;

    for (let i = 0; i < MAX_TURNS; i++) {
      // For Gemini, we might need to adjust how we handle tool calls if using native function calling.
      // But since BaseAgent abstracts it (somewhat), we'll assume text generation for now 
      // or implement a ReAct pattern if native tools aren't fully wired in BaseAgent yet.
      // Given BaseAgent.runCompletion returns OpenAI format, we'll proceed with that.

      const response = await this.runCompletion(messages);
      const message = response.choices[0].message;
      
      // Check if LLM wants to call a tool (OpenAI format)
      // Note: BaseAgent's runGeminiCompletion currently returns text content. 
      // To support tools properly with Gemini in this structure, we'd need to parse the text for tool calls
      // or upgrade BaseAgent to support Gemini Function Calling.
      // For now, let's assume the LLM might output JSON or a specific format if instructed, 
      // OR we rely on the fact that we haven't passed `tools` to `runCompletion` in the loop yet.
      
      // Let's try to use a ReAct pattern via prompt engineering if native tools aren't fully ready,
      // OR pass tools to runCompletion if BaseAgent supports it.
      // BaseAgent.runCompletion accepts tools. Let's pass them.
      
      // We need to convert our Tool[] to OpenAI tool format
      const openAiTools = this.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));

      // Re-call with tools
      const toolResponse = await this.runCompletion(messages, openAiTools as any);
      const toolMessage = toolResponse.choices[0].message;
      
      if (toolMessage.tool_calls && toolMessage.tool_calls.length > 0) {
        messages.push(toolMessage); // Add assistant message with tool calls
        
        for (const toolCall of toolMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolParams = JSON.parse(toolCall.function.arguments);
          
          toolsInvoked.push(toolName);
          
          try {
            const result = await this.executeTool(toolName, toolParams, context);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(result)
            });
          } catch (error) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify({ error: error.message })
            });
          }
        }
      } else {
        // No tool calls, final response
        finalOutput = toolMessage.content || "I'm sorry, I couldn't process that.";
        break;
      }
    }

    return {
      success: true,
      finalOutput,
      toolsInvoked,
      duration: Date.now() - startTime
    };
  }

  protected formatSingleOption(option: any): string {
    return `${option.name} (${option.category}) - ${option.address}\nPhone: ${option.phone || 'N/A'}\nRating: ${option.rating || 'N/A'}⭐`;
  }

  protected calculateScore(option: any, criteria: any): number {
    return option.rating || 0;
  }
}

