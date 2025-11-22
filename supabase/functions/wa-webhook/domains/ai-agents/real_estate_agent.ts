/**
 * Real Estate AI Agent - Rebuilt with AI Core
 * Uses Gemini 2.5 Pro with vision for property search and viewings
 */

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { sendText } from "../../wa/client.ts";
import { RouterContext } from "../../types.ts";

interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any, context: any) => Promise<any>;
}

/**
 * Real Estate Agent
 * Multilingual property search and viewing assistant
 */
export class RealEstateAgent {
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
    return `You are a multilingual real-estate concierge for Rwanda. Help users find properties (rentals, sales, short-term).

YOUR ROLE:
- Capture property requirements (location, price, beds, amenities)
- Search internal listings and external sources
- Contact property owners
- Schedule viewings
- Present top 5 options with reasons

PROPERTY TYPES:
- Residential (apartments, houses, villas)
- Commercial (offices, shops, warehouses)
- Land (plots, agricultural)
- Short-term (vacation rentals, Airbnb)

SEARCH CRITERIA:
- Location (city, neighborhood)
- Price range
- Bedrooms/bathrooms
- Amenities (parking, wifi, security, pool)
- Property type and size

GUIDELINES:
- Collect complete requirements before searching
- Present properties with clear pros/cons
- Include photos and contact information
- Help schedule viewings
- No legal or visa advice
- No price guarantees

GUARDRAILS:
- Respect GDPR/regional privacy
- Keep owner contact details private until handoff
- Clearly label estimates vs confirmed info
- No sending raw external links

TOOLS AVAILABLE:
- search_properties: Find properties in database
- get_property_details: Get full property information
- contact_owner: Send message to property owner
- schedule_viewing: Arrange property viewing
- save_favorite: Save property to favorites

Always be helpful, professional, and transparent.`;
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_properties',
        description: 'Search for properties by criteria',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City or neighborhood' },
            price_min: { type: 'number', description: 'Minimum price in RWF' },
            price_max: { type: 'number', description: 'Maximum price in RWF' },
            bedrooms: { type: 'number', description: 'Number of bedrooms' },
            property_type: { type: 'string', enum: ['apartment', 'house', 'villa', 'office', 'shop', 'land'] },
            listing_type: { type: 'string', enum: ['rent', 'sale', 'short_term'] }
          }
        },
        execute: async (params) => {
          let query = this.supabase
            .from('property_listings')
            .select('id, title, location, price, bedrooms, bathrooms, property_type, listing_type, amenities')
            .eq('status', 'active');

          if (params.location) {
            query = query.ilike('location', `%${params.location}%`);
          }

          if (params.price_min) {
            query = query.gte('price', params.price_min);
          }

          if (params.price_max) {
            query = query.lte('price', params.price_max);
          }

          if (params.bedrooms) {
            query = query.gte('bedrooms', params.bedrooms);
          }

          if (params.property_type) {
            query = query.eq('property_type', params.property_type);
          }

          if (params.listing_type) {
            query = query.eq('listing_type', params.listing_type);
          }

          query = query.limit(5);

          const { data, error } = await query;

          if (error || !data || data.length === 0) {
            return { message: 'No properties found matching your criteria.' };
          }

          return {
            count: data.length,
            properties: data.map(p => ({
              id: p.id,
              title: p.title,
              location: p.location,
              price: `${p.price} RWF`,
              bedrooms: p.bedrooms,
              bathrooms: p.bathrooms,
              type: p.property_type,
              listing_type: p.listing_type,
              amenities: p.amenities
            }))
          };
        }
      },
      {
        name: 'get_property_details',
        description: 'Get detailed information about a property',
        parameters: {
          type: 'object',
          properties: {
            property_id: { type: 'string' }
          },
          required: ['property_id']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('property_listings')
            .select('*')
            .eq('id', params.property_id)
            .single();

          if (error || !data) {
            return { error: 'Property not found' };
          }

          return {
            property: {
              title: data.title,
              description: data.description,
              location: data.location,
              price: data.price,
              bedrooms: data.bedrooms,
              bathrooms: data.bathrooms,
              size_sqm: data.size_sqm,
              property_type: data.property_type,
              listing_type: data.listing_type,
              amenities: data.amenities,
              photos: data.photos,
              owner_contact: data.owner_phone
            }
          };
        }
      },
      {
        name: 'contact_owner',
        description: 'Send message to property owner',
        parameters: {
          type: 'object',
          properties: {
            property_id: { type: 'string' },
            user_id: { type: 'string' },
            message: { type: 'string' }
          },
          required: ['property_id', 'user_id', 'message']
        },
        execute: async (params) => {
          // Log the contact request
          const { data, error } = await this.supabase
            .from('property_inquiries')
            .insert({
              property_id: params.property_id,
              user_id: params.user_id,
              message: params.message,
              status: 'sent',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to contact owner' };
          }

          return {
            inquiry_id: data.id,
            status: 'sent',
            message: 'Your message has been sent to the property owner. They will contact you soon.'
          };
        }
      },
      {
        name: 'schedule_viewing',
        description: 'Schedule a property viewing',
        parameters: {
          type: 'object',
          properties: {
            property_id: { type: 'string' },
            user_id: { type: 'string' },
            preferred_date: { type: 'string' },
            preferred_time: { type: 'string' }
          },
          required: ['property_id', 'user_id', 'preferred_date']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('property_viewings')
            .insert({
              property_id: params.property_id,
              user_id: params.user_id,
              viewing_date: params.preferred_date,
              viewing_time: params.preferred_time,
              status: 'requested',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to schedule viewing' };
          }

          return {
            viewing_id: data.id,
            date: params.preferred_date,
            time: params.preferred_time,
            status: 'requested',
            message: 'Viewing request sent. The owner will confirm the appointment.'
          };
        }
      },
      {
        name: 'save_favorite',
        description: 'Save property to user favorites',
        parameters: {
          type: 'object',
          properties: {
            property_id: { type: 'string' },
            user_id: { type: 'string' }
          },
          required: ['property_id', 'user_id']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('property_favorites')
            .insert({
              property_id: params.property_id,
              user_id: params.user_id,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to save favorite' };
          }

          return {
            message: 'Property saved to your favorites',
            favorite_id: data.id
          };
        }
      }
    ];
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
          parts: [{ text: "Hello! I'm your real estate assistant. I'll help you find the perfect property." }],
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

export async function runRealEstateAgent(ctx: RouterContext, query: string) {
  try {
    const agent = new RealEstateAgent(ctx.supabase);
    const response = await agent.execute(query, { userId: ctx.from });
    await sendText(ctx.from, response);
    return true;
  } catch (error) {
    console.error("RealEstateAgent error:", error);
    await sendText(ctx.from, "Real Estate Agent is currently unavailable.");
    return false;
  }
}
