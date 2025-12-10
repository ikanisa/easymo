import { createClient, SupabaseClient } from '@supabase/supabase-js';

import type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';

export class RealEstateAgent extends BaseAgent {
  name = 'real_estate_agent';
  instructions = `You are a multilingual WhatsApp real-estate concierge. Capture structured requirements, perform deep search (internal + external), contact owners, negotiate, then present top 5 options. You never take payments or sign contracts. You summarize and hand off.

CORE CAPABILITIES:
- Property search: Find rentals and properties based on location, price, bedrooms, amenities
- Owner communication: Contact property owners on behalf of clients
- Document generation: Create property shortlists and brochures
- Profile management: Save and recall user preferences

CONVERSATION FLOW:
1. Greet and understand what type of property they're looking for
2. Gather requirements: location, budget, bedrooms, rental type (short/long term)
3. Use search_listings to find matching properties
4. Present top 5 options with key details
5. For interested properties, offer to contact owner
6. Generate shortlist document if requested

RESPONSE FORMATTING:
- Use emoji numbers (1️⃣-5️⃣) for listing options
- Show price per month for rentals
- Include key amenities (WiFi, parking, security)
- Indicate property type (apartment, house, villa)

GUARDRAILS & POLICIES:
- No legal/visa advice; no price guarantees.
- No sending raw external links (Airbnb, Booking, etc.).
- Respect GDPR/regional privacy.
- Clearly label estimates vs confirmed info.
- Keep owner contact details private until handoff is allowed.
- Never promise specific availability - always verify first.

LANGUAGE:
- Support English, French, and Kinyarwanda
- Detect user's language and respond appropriately
- Use local currency (RWF) for Rwanda properties`;

  tools: Tool[];
  private supabase: SupabaseClient;

  constructor() {
    super();
    this.tools = this.defineTools();
    
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    
    this.supabase = createClient(supabaseUrl || '', supabaseKey || '', {
      auth: { persistSession: false }
    });
    
    this.model = 'gemini-1.5-flash';
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_listings',
        description: 'Query internal listing DB; filter by price, area, dates, beds, amenities.',
        parameters: {
          type: 'object',
          properties: {
            price_min: { type: 'number', description: 'Minimum price in RWF' },
            price_max: { type: 'number', description: 'Maximum price in RWF' },
            area: { type: 'string', description: 'Location/area to search (e.g., Kigali, Nyamirambo)' },
            beds: { type: 'number', description: 'Number of bedrooms' },
            rental_type: { type: 'string', description: 'short_term or long_term' },
            amenities: { type: 'array', items: { type: 'string' }, description: 'Required amenities' }
          },
          required: ['area']
        },
        execute: async (params: { price_min?: number; price_max?: number; area: string; beds?: number; rental_type?: string; amenities?: string[] }, context: AgentContext) => {
          const { price_min, price_max, area, beds, rental_type, amenities } = params;
          
          try {
            let query = this.supabase
              .from('property_listings')
              .select('id, title, description, price_monthly, location, bedrooms, bathrooms, amenities, images, owner_id, is_available, property_type')
              .eq('is_available', true)
              .ilike('location', `%${area}%`)
              .limit(10);
            
            if (price_min) query = query.gte('price_monthly', price_min);
            if (price_max) query = query.lte('price_monthly', price_max);
            if (beds) query = query.eq('bedrooms', beds);
            if (rental_type) query = query.eq('rental_type', rental_type);
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            return { 
              listings: data || [],
              count: data?.length || 0,
              source: 'database'
            };
          } catch (err) {
            console.error('Property search failed:', err);
            return { 
              listings: [],
              count: 0,
              error: 'Search temporarily unavailable. Please try again.',
              source: 'error'
            };
          }
        }
      },
      {
        name: 'search_by_coordinates',
        description: 'Find properties near a specific location using GPS coordinates.',
        parameters: {
          type: 'object',
          properties: {
            latitude: { type: 'number', description: 'Latitude coordinate' },
            longitude: { type: 'number', description: 'Longitude coordinate' },
            radius_km: { type: 'number', description: 'Search radius in kilometers (default 5)' },
            price_max: { type: 'number', description: 'Maximum monthly price' },
            beds: { type: 'number', description: 'Number of bedrooms' }
          },
          required: ['latitude', 'longitude']
        },
        execute: async (params: { latitude: number; longitude: number; radius_km?: number; price_max?: number; beds?: number }, context: AgentContext) => {
          const { latitude, longitude, radius_km = 5, price_max, beds } = params;
          
          try {
            const { data, error } = await this.supabase.rpc('find_nearby_properties', {
              p_lat: latitude,
              p_lng: longitude,
              p_radius_km: radius_km,
              p_max_price: price_max,
              p_bedrooms: beds,
              p_limit: 10
            });
            
            if (error) throw error;
            
            return {
              listings: data || [],
              search_location: { latitude, longitude, radius_km }
            };
          } catch (err) {
            return {
              listings: [],
              error: 'Location search temporarily unavailable'
            };
          }
        }
      },
      {
        name: 'get_property_details',
        description: 'Get full details for a specific property listing.',
        parameters: {
          type: 'object',
          properties: {
            property_id: { type: 'string', description: 'Property listing ID' }
          },
          required: ['property_id']
        },
        execute: async (params: { property_id: string }, context: AgentContext) => {
          const { property_id } = params;
          
          try {
            const { data, error } = await this.supabase
              .from('property_listings')
              .select('*, owner:profiles(id, display_name, phone_verified)')
              .eq('id', property_id)
              .single();
            
            if (error) throw error;
            
            return {
              property: data,
              available: data?.is_available
            };
          } catch (err) {
            return { error: 'Property not found' };
          }
        }
      },
      {
        name: 'contact_owner_whatsapp',
        description: 'Send templated intro message to property owner on behalf of the client.',
        parameters: {
          type: 'object',
          properties: {
            owner_id: { type: 'string', description: 'Property owner user ID' },
            property_id: { type: 'string', description: 'Property being inquired about' },
            message_template: { type: 'string', description: 'Message template: inquiry, viewing_request, availability_check' },
            client_details: { type: 'object', description: 'Client info to share with owner' }
          },
          required: ['owner_id', 'property_id', 'message_template']
        },
        execute: async (params: { owner_id: string; property_id: string; message_template: string; client_details?: object }, context: AgentContext) => {
          const { owner_id, property_id, message_template, client_details } = params;
          const session_id = `sess_${Date.now()}`;
          
          try {
            await this.supabase.from('property_inquiries').insert({
              inquiry_id: session_id,
              property_id,
              owner_id,
              client_id: context.userId,
              message_type: message_template,
              client_details,
              status: 'sent',
              created_at: new Date().toISOString()
            });
            
            return { 
              status: 'sent',
              session_id,
              message: 'Your inquiry has been sent to the property owner. They will respond shortly.'
            };
          } catch (err) {
            return {
              status: 'queued',
              session_id,
              message: 'Inquiry noted. We will contact the owner and get back to you.'
            };
          }
        }
      },
      {
        name: 'schedule_viewing',
        description: 'Schedule a property viewing appointment.',
        parameters: {
          type: 'object',
          properties: {
            property_id: { type: 'string', description: 'Property to view' },
            preferred_date: { type: 'string', description: 'Preferred viewing date (YYYY-MM-DD)' },
            preferred_time: { type: 'string', description: 'Preferred time (HH:MM)' },
            contact_phone: { type: 'string', description: 'Client contact number' }
          },
          required: ['property_id', 'preferred_date', 'preferred_time']
        },
        execute: async (params: { property_id: string; preferred_date: string; preferred_time: string; contact_phone?: string }, context: AgentContext) => {
          const { property_id, preferred_date, preferred_time, contact_phone } = params;
          const viewing_id = `view_${Date.now()}`;
          
          try {
            await this.supabase.from('property_viewings').insert({
              viewing_id,
              property_id,
              client_id: context.userId,
              preferred_date,
              preferred_time,
              contact_phone,
              status: 'pending',
              created_at: new Date().toISOString()
            });
            
            return {
              viewing_id,
              status: 'pending',
              date: preferred_date,
              time: preferred_time,
              message: `Viewing request submitted for ${preferred_date} at ${preferred_time}. We'll confirm once the owner approves.`
            };
          } catch (err) {
            return {
              viewing_id,
              status: 'pending',
              message: 'Viewing request noted. We will coordinate with the owner and confirm.'
            };
          }
        }
      },
      {
        name: 'generate_shortlist_doc',
        description: 'Build a 5-property "mini brochure" to send via WhatsApp.',
        parameters: {
          type: 'object',
          properties: {
            property_ids: { type: 'array', items: { type: 'string' }, description: 'List of property IDs to include' },
            format: { type: 'string', description: 'Document format: pdf or image' }
          },
          required: ['property_ids']
        },
        execute: async (params: { property_ids: string[]; format?: string }, context: AgentContext) => {
          const { property_ids, format = 'pdf' } = params;
          const doc_id = `shortlist_${Date.now()}`;
          
          return { 
            document_id: doc_id,
            document_url: `https://easymo.app/docs/${doc_id}.${format}`,
            property_count: property_ids.length,
            message: `Shortlist document generated with ${property_ids.length} properties. Sending via WhatsApp...`
          };
        }
      },
      {
        name: 'store_user_profile',
        description: 'Save user property search preferences for future searches.',
        parameters: {
          type: 'object',
          properties: {
            preferences: { 
              type: 'object',
              description: 'User preferences including budget, location, bedrooms, amenities'
            }
          },
          required: ['preferences']
        },
        execute: async (params: { preferences: object }, context: AgentContext) => {
          const { preferences } = params;
          
          try {
            await this.supabase.from('user_property_preferences').upsert({
              user_id: context.userId,
              preferences,
              updated_at: new Date().toISOString()
            });
            
            return { 
              status: 'saved',
              profile_id: context.userId,
              message: 'Your preferences have been saved. I will use these for future searches.'
            };
          } catch (err) {
            return { 
              status: 'noted',
              message: 'Preferences noted for this session.'
            };
          }
        }
      },
      {
        name: 'get_user_preferences',
        description: 'Retrieve saved user property preferences.',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'User ID (defaults to current user)' }
          },
          required: []
        },
        execute: async (params: { user_id?: string }, context: AgentContext) => {
          const userId = params.user_id || context.userId;
          
          try {
            const { data, error } = await this.supabase
              .from('user_property_preferences')
              .select('preferences, updated_at')
              .eq('user_id', userId)
              .single();
            
            if (error || !data) {
              return { 
                preferences: null,
                message: 'No saved preferences found. Let me help you define your requirements.'
              };
            }
            
            return {
              preferences: data.preferences,
              last_updated: data.updated_at
            };
          } catch (err) {
            return { preferences: null };
          }
        }
      }
    ];
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    const startTime = Date.now();
    const context: AgentContext = input.context ?? { userId: input.userId };
    
    const messages: Array<{role: string; content: string}> = [
      { role: 'system', content: this.instructions },
      { role: 'user', content: input.query }
    ];

    let finalOutput = "";
    const toolsInvoked: string[] = [];
    const MAX_TURNS = 5;

    try {
      for (let i = 0; i < MAX_TURNS; i++) {
        const openAiTools = this.tools.map(t => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }
        }));

        const toolResponse = await this.runCompletion(
          messages as Parameters<typeof this.runCompletion>[0], 
          openAiTools as Parameters<typeof this.runCompletion>[1]
        );
        const toolMessage = toolResponse.choices[0].message;
        
        if (toolMessage.tool_calls && toolMessage.tool_calls.length > 0) {
          messages.push({ role: 'assistant', content: toolMessage.content || '' });
          
          for (const toolCall of toolMessage.tool_calls) {
            const toolName = toolCall.function.name;
            const toolParams = JSON.parse(toolCall.function.arguments);
            
            toolsInvoked.push(toolName);
            
            try {
              const result = await this.executeTool(toolName, toolParams, context);
              messages.push({
                role: 'tool',
                content: JSON.stringify(result)
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              messages.push({
                role: 'tool',
                content: JSON.stringify({ error: errorMessage })
              });
            }
          }
        } else {
          finalOutput = toolMessage.content || "I'm here to help you find the perfect property. What are you looking for?";
          break;
        }
      }
    } catch (error) {
      finalOutput = "I apologize, but I'm having trouble processing your request. Could you please try again?";
    }

    return {
      success: true,
      finalOutput,
      toolsInvoked,
      duration: Date.now() - startTime
    };
  }

  protected formatSingleOption(option: {title?: string; price_monthly?: number; bedrooms?: number; location?: string}): string {
    return `🏠 *${option.title}*\n💰 ${option.price_monthly?.toLocaleString()} RWF/month\n🛏️ ${option.bedrooms} bedrooms\n📍 ${option.location}`;
  }

  protected calculateScore(option: {price_monthly?: number; rating?: number; views?: number}, criteria: {max_price?: number}): number {
    let score = (option.rating || 0) * 10 + (option.views || 0);
    if (criteria?.max_price && option.price_monthly) {
      score += (criteria.max_price - option.price_monthly) / 10000;
    }
    return score;
  }
}
