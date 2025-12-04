import { childLogger } from '@easymo/commons';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

import type { AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';

const log = childLogger({ service: 'agents' });

/**
 * Buy & Sell Agent
 * 
 * Unified commerce and business discovery agent that consolidates:
 * - Marketplace Agent (pharmacy, hardware, grocery commerce)
 * - Business Broker Agent (business sales, acquisitions, legal intake)
 * 
 * Capabilities:
 * - Product commerce: Find products, check availability, place orders
 * - Business discovery: Map user needs → business categories → specific nearby businesses
 * - Business brokerage: Connect business buyers/sellers, facilitate valuations
 * - Legal intake: Triage cases, collect facts, prepare engagement letters
 */
export class BuyAndSellAgent extends BaseAgent {
  name = 'buy_and_sell_agent';
  instructions = `You are EasyMO's unified Buy & Sell assistant, helping users with marketplace transactions and business opportunities.

MARKETPLACE CAPABILITIES:
- Help users buy and sell products across all retail categories (pharmacy, hardware, grocery)
- Find shops and stores nearby
- Create and manage product listings
- Search for specific items
- Handle OTC pharmacy products; for RX items, request photo and escalate to pharmacist
- No medical advice, dosing, or contraindication information

BUSINESS DISCOVERY:
- Map user needs → business categories → specific nearby businesses
- Use maps_geocode for location-based search
- Return ranked list with reasons (open now, distance, rating)
- Only recommend businesses from the database; respect opening hours

BUSINESS BROKERAGE:
- For sellers: Collect business details, financials (sanitized), asking price, terms
- For buyers: Understand acquisition criteria, budget, industry preferences
- Match parties; facilitate introductions; schedule meetings
- Generate NDAs and LOIs via generate_pdf when parties proceed

LEGAL INTAKE (handoff required):
- Triage case category (business, contract, IP, employment, etc.)
- Collect facts: who/what/when/where and desired outcome
- Prepare scope summary; generate engagement letter PDF
- Take retainer via momo_charge; open case file
- All substantive matters require human associate review

GUARDRAILS:
- No medical advice beyond finding a pharmacy
- No legal, tax, or financial advice—only logistics and intake
- Protect user privacy and confidentiality
- Sensitive topics require handoff to staff

FLOW:
1) Identify intent: product search, business discovery, business sale/purchase, or legal intake
2) For products: search_supabase/inventory_check; present options; build basket
3) For business discovery: maps_geocode + search_businesses; present ranked options
4) For business transactions: collect details; match parties; generate documents
5) For all orders: momo_charge; confirm after settlement; track via order_status_update
6) Notify fulfillment (notify_staff); escalate sensitive topics immediately`;

  tools: Tool[];
  private supabase: SupabaseClient;

  constructor() {
    super();
    this.tools = this.defineTools();
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      log.warn("Supabase credentials missing for BuyAndSellAgent");
    }
    
    this.supabase = createClient(supabaseUrl || '', supabaseKey || '', {
      auth: { persistSession: false }
    });
    
    // Set model to Gemini
    this.model = 'gemini-1.5-flash';
  }

  private defineTools(): Tool[] {
    return [
      // Business discovery tools (from BusinessBrokerAgent)
      {
        name: 'search_businesses',
        description: 'Find businesses by location and category. Returns sorted list with distance.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Business category (e.g., pharmacy, restaurant, hardware)' },
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
            log.error("RPC search_businesses_nearby failed:", error);
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
                q: `${address}, Rwanda`,
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
            
            return { error: "Location not found" };
          } catch (error) {
            log.error("Geocode error:", error);
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
      },
      // Marketplace tools
      {
        name: 'search_products',
        description: 'Search for products in the marketplace across all categories.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query for products' },
            category: { type: 'string', description: 'Product category filter (pharmacy, hardware, grocery)' },
            price_max: { type: 'number', description: 'Maximum price filter' },
            limit: { type: 'number', description: 'Max results (default 10)' }
          },
          required: ['query']
        },
        execute: async (params, context) => {
          const { query, category, price_max, limit = 10 } = params;
          
          let queryBuilder = this.supabase
            .from('products')
            .select('*')
            .ilike('name', `%${query}%`)
            .eq('is_active', true);
          
          if (category) {
            queryBuilder = queryBuilder.eq('category', category);
          }
          
          if (price_max) {
            queryBuilder = queryBuilder.lte('price', price_max);
          }
          
          const { data, error } = await queryBuilder.limit(limit);
          
          if (error) throw new Error(`Product search failed: ${error.message}`);
          return { products: data };
        }
      },
      {
        name: 'inventory_check',
        description: 'Check inventory/stock levels for a specific product.',
        parameters: {
          type: 'object',
          properties: {
            product_id: { type: 'string', description: 'Product ID to check' },
            store_id: { type: 'string', description: 'Optional store ID' }
          },
          required: ['product_id']
        },
        execute: async (params, context) => {
          const { product_id, store_id } = params;
          
          let queryBuilder = this.supabase
            .from('inventory')
            .select('*, product:products(*), store:stores(*)')
            .eq('product_id', product_id);
          
          if (store_id) {
            queryBuilder = queryBuilder.eq('store_id', store_id);
          }
          
          const { data, error } = await queryBuilder;
          
          if (error) throw new Error(`Inventory check failed: ${error.message}`);
          return { inventory: data };
        }
      },
      {
        name: 'create_listing',
        description: 'Create a new product or business listing.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Listing title' },
            description: { type: 'string', description: 'Listing description' },
            price: { type: 'number', description: 'Price in local currency' },
            category: { type: 'string', description: 'Product/business category' },
            listing_type: { type: 'string', description: 'Type of listing: product, service, business' }
          },
          required: ['title', 'category', 'listing_type']
        },
        execute: async (params, context) => {
          const { title, description, price, category, listing_type } = params;
          
          const { data, error } = await this.supabase
            .from('unified_listings')
            .insert({
              title,
              description,
              price,
              category,
              listing_type,
              owner_user_id: context?.userId,
              domain: listing_type === 'business' ? 'business' : 'marketplace',
              status: 'active',
              source_agent: 'buy_and_sell',
              created_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (error) throw new Error(`Listing creation failed: ${error.message}`);
          return { listing: data, message: 'Listing created successfully!' };
        }
      },
      // Order management tools
      {
        name: 'order_create',
        description: 'Create a new order for products.',
        parameters: {
          type: 'object',
          properties: {
            items: { 
              type: 'array', 
              description: 'Array of items with product_id and quantity',
              items: {
                type: 'object',
                properties: {
                  product_id: { type: 'string' },
                  quantity: { type: 'number' }
                }
              }
            },
            delivery_address: { type: 'string', description: 'Delivery address' }
          },
          required: ['items']
        },
        execute: async (params, context) => {
          const { items, delivery_address } = params;
          
          const { data, error } = await this.supabase
            .from('orders')
            .insert({
              items: items,
              delivery_address,
              user_id: context?.userId,
              status: 'pending',
              source_agent: 'buy_and_sell',
              created_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (error) throw new Error(`Order creation failed: ${error.message}`);
          return { order: data, message: 'Order created! Awaiting payment.' };
        }
      },
      {
        name: 'order_status_update',
        description: 'Update the status of an order.',
        parameters: {
          type: 'object',
          properties: {
            order_id: { type: 'string', description: 'Order ID' },
            status: { type: 'string', description: 'New status: pending, confirmed, preparing, shipped, delivered, cancelled' }
          },
          required: ['order_id', 'status']
        },
        execute: async (params, context) => {
          const { order_id, status } = params;
          
          const { data, error } = await this.supabase
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', order_id)
            .select()
            .single();
          
          if (error) throw new Error(`Order status update failed: ${error.message}`);
          return { order: data, message: `Order status updated to: ${status}` };
        }
      }
    ];
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    const startTime = Date.now();
    const context = input.context ?? { userId: input.userId };
    
    const messages: any[] = [
      { role: 'system', content: this.instructions },
      { role: 'user', content: input.query }
    ];

    let finalOutput = "";
    const toolsInvoked: string[] = [];
    const MAX_TURNS = 5;

    for (let i = 0; i < MAX_TURNS; i++) {
      const openAiTools = this.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));

      const toolResponse = await this.runCompletion(messages, openAiTools as any);
      const toolMessage = toolResponse.choices[0].message;
      
      if (toolMessage.tool_calls && toolMessage.tool_calls.length > 0) {
        messages.push(toolMessage);
        
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
          } catch (error: any) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify({ error: error.message })
            });
          }
        }
      } else {
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
    if (option.name) {
      // Business format
      return `${option.name} (${option.category}) - ${option.address}\nPhone: ${option.phone || 'N/A'}\nRating: ${option.rating || 'N/A'}⭐`;
    } else if (option.title) {
      // Product/listing format
      return `${option.title} - ${option.price || 'Price TBD'}\n${option.description || ''}`;
    }
    return JSON.stringify(option);
  }

  protected calculateScore(option: any, criteria: any): number {
    return option.rating || option.views || 0;
  }
}

/**
 * Export a convenience function to run the Buy & Sell Agent
 */
export async function runBuyAndSellAgent(input: AgentInput): Promise<AgentResult> {
  const agent = new BuyAndSellAgent();
  return agent.execute(input);
}
