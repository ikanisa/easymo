import { childLogger } from '@easymo/commons';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

import type { AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';
import { BUY_SELL_SYSTEM_PROMPT } from './buy-and-sell/prompts/system-prompt';
import { 
  BUY_SELL_AGENT_SLUG, 
  BUY_SELL_DEFAULT_MODEL 
} from './buy-and-sell/config';
import { searchBusinessesAI, searchBusinesses } from './buy-and-sell/tools/search-businesses';
import { searchProducts, inventoryCheck } from './buy-and-sell/tools/search-products';
import { mapsGeocode } from './buy-and-sell/tools/maps-geocode';
import { businessDetails } from './buy-and-sell/tools/business-details';

const log = childLogger({ service: 'agents', agent: 'buy-and-sell' });

/**
 * Buy & Sell Agent
 * 
 * SINGLE SOURCE OF TRUTH for Buy & Sell AI agent.
 * Consolidated implementation that replaces:
 * - packages/agents/src/agents/commerce/buy-and-sell.agent.ts (this file - refactored)
 * - admin-app/lib/ai/domain/marketplace-agent.ts (now re-exports from here)
 * - supabase/functions/wa-webhook-buy-sell/agent.ts (uses Deno wrapper)
 * 
 * Capabilities:
 * - Product commerce: Find products, check availability, place orders
 * - Business discovery: Map user needs → business categories → specific nearby businesses
 * - Business brokerage: Connect business buyers/sellers, facilitate valuations
 * - Legal intake: Triage cases, collect facts, prepare engagement letters
 * 
 * @see docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md
 */
export class BuyAndSellAgent extends BaseAgent {
  static readonly SLUG = BUY_SELL_AGENT_SLUG;
  
  name = 'buy_and_sell_agent';
  instructions = BUY_SELL_SYSTEM_PROMPT;
  tools: Tool[];
  
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    super();
    
    // Use provided client or create new one
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        log.warn("Supabase credentials missing for BuyAndSellAgent");
      }
      
      this.supabase = createClient(supabaseUrl || '', supabaseKey || '', {
        auth: { persistSession: false }
      });
    }
    
    // Initialize tools with modular structure
    this.tools = this.defineTools();
    
    // Set default model
    this.model = BUY_SELL_DEFAULT_MODEL;
  }

  /**
   * Define all tools using modular tool functions
   */
  private defineTools(): Tool[] {
    return [
      // Business Discovery
      searchBusinessesAI(this.supabase),
      searchBusinesses(this.supabase),
      businessDetails(this.supabase),
      
      // Location
      mapsGeocode(),
      
      // Marketplace
      searchProducts(this.supabase),
      inventoryCheck(this.supabase),
    ];
  }

  /**
   * Execute the agent with input
   */
  async execute(input: AgentInput): Promise<AgentResult> {
    // Call parent class implementation
    return await (BaseAgent.prototype as any).execute.call(this, input);
  }
  
  /**
   * Format a single option for display (required by BaseAgent)
   */
  protected formatSingleOption(option: any): string {
    if (option.name) {
      // Business format
      return `${option.name} (${option.category || 'Business'}) - ${option.address || 'Address N/A'}\nPhone: ${option.phone || 'N/A'}\nRating: ${option.rating || 'N/A'}⭐`;
    } else if (option.title) {
      // Product/listing format
      return `${option.title} - ${option.price || 'Price TBD'}\n${option.description || ''}`;
    }
    return JSON.stringify(option);
  }

  /**
   * Calculate score for ranking (required by BaseAgent)
   */
  protected calculateScore(option: any, criteria: any): number {
    return option.rating || option.views || option.relevance_score || 0;
  }
}

/**
 * Backward compatibility alias
 * @deprecated Use BuyAndSellAgent instead
 */
export class MarketplaceAgent extends BuyAndSellAgent {
  constructor(supabaseClient?: SupabaseClient) {
    super(supabaseClient);
    log.warn('MarketplaceAgent is deprecated. Use BuyAndSellAgent instead.');
  }
}

/**
 * Export a convenience function to run the Buy & Sell Agent
 */
export async function runBuyAndSellAgent(input: AgentInput): Promise<AgentResult> {
  const agent = new BuyAndSellAgent();
  return agent.execute(input);
}

// Keep the rest of the legacy implementation below for now
// TODO: Remove after confirming new modular structure works
class BuyAndSellAgentLegacy extends BaseAgent {
  name = 'buy_and_sell_agent_legacy';
  instructions = BUY_SELL_SYSTEM_PROMPT; // Add missing instructions
  tools: Tool[];
  private supabase: SupabaseClient;

  constructor() {
    super();
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    this.supabase = createClient(supabaseUrl || '', supabaseKey || '', { auth: { persistSession: false } });
    this.tools = this.defineToolsLegacy();
    this.model = BUY_SELL_DEFAULT_MODEL;
  }
  
  // Required abstract method implementations
  protected formatSingleOption(option: any): string {
    if (option.name) {
      return `${option.name} (${option.category}) - ${option.address}\nPhone: ${option.phone || 'N/A'}\nRating: ${option.rating || 'N/A'}⭐`;
    } else if (option.title) {
      return `${option.title} - ${option.price || 'Price TBD'}\n${option.description || ''}`;
    }
    return JSON.stringify(option);
  }

  protected calculateScore(option: any, criteria: any): number {
    return option.rating || option.views || 0;
  }

  private defineToolsLegacy(): Tool[] {
    return [
      // Business discovery tools - ENHANCED with AI search
      {
        name: 'search_businesses_ai',
        description: 'Natural language search for businesses. Finds businesses based on user query like "I need a computer" or "pharmacy nearby". Uses AI-powered relevance ranking.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Natural language query (e.g., "computer shop", "print documents", "fix phone")' },
            lat: { type: 'number', description: 'User latitude (optional, for location-aware results)' },
            lng: { type: 'number', description: 'User longitude (optional, for location-aware results)' },
            radius_km: { type: 'number', description: 'Search radius in km (default 10)' },
            limit: { type: 'number', description: 'Max results (default 5)' }
          },
          required: ['query']
        },
        execute: async (params, context) => {
          const { query, lat = null, lng = null, radius_km = 10, limit = 5 } = params;
          
          log.info({ query, lat, lng }, 'Executing AI business search');
          
          // Use the new AI-powered search function from Phase 1 migrations
          const { data, error } = await this.supabase.rpc('search_businesses_ai', {
            p_query: query,
            p_lat: lat,
            p_lng: lng,
            p_radius_km: radius_km,
            p_limit: limit
          });

          if (error) {
            log.error({ error }, 'AI business search failed');
            // Fallback to basic search
            return await this.fallbackBusinessSearch(query, lat, lng, radius_km, limit);
          }

          log.info({ count: data?.length || 0 }, 'AI search returned results');
          return { 
            businesses: data,
            source: 'ai_search'
          };
        }
      },
      {
        name: 'search_businesses',
        description: 'Find businesses by category and location. Use search_businesses_ai for natural language queries.',
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
          
          // Use the new nearby businesses function
          const { data, error } = await this.supabase.rpc('find_nearby_businesses', {
            p_lat: lat,
            p_lng: lng,
            p_radius_km: radius_km,
            p_category: category,
            p_limit: limit
          });

          if (error) {
            log.error({ error }, 'Nearby business search failed');
            return await this.fallbackBusinessSearch(category, lat, lng, radius_km, limit);
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
            log.error({ error: String(error) }, 'Geocode error');
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
              source_agent: 'buy_sell',
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
              source_agent: 'buy_sell',
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

  /**
   * Fallback business search when AI search fails
   */
  private async fallbackBusinessSearch(
    query: string, 
    lat: number | null, 
    lng: number | null, 
    radius_km: number, 
    limit: number
  ) {
    log.warn('Using fallback business search');
    
    try {
      let queryBuilder = this.supabase
        .from('business')
        .select('*')
        .eq('is_active', true);
      
      // Text search on name and category
      queryBuilder = queryBuilder.or(`name.ilike.%${query}%,category_name.ilike.%${query}%,tag.ilike.%${query}%`);
      
      const { data, error } = await queryBuilder.limit(limit);
      
      if (error) {
        log.error({ error }, 'Fallback search also failed');
        return { businesses: [], error: 'Search temporarily unavailable' };
      }
      
      return {
        businesses: data,
        source: 'fallback_search'
      };
    } catch (error) {
      log.error({ error: String(error) }, 'Fallback search error');
      return { businesses: [], error: 'Search failed' };
    }
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
}

