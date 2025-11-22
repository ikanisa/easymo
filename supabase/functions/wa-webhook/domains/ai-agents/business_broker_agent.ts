/**
 * Business Broker AI Agent - Rebuilt with AI Core
 * Uses Gemini 2.5 Pro for business discovery and recommendations
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
 * Business Broker Agent
 * Helps users find businesses, services, and products nearby
 */
export class BusinessBrokerAgent {
  private supabase: SupabaseClient;
  private gemini: GoogleGenerativeAI;
  private model: string = 'gemini-2.5-pro-latest'; // Upgraded to 2.5 Pro
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
    return `You are the easyMO Business Broker AI Agent. You help users find businesses, services, and products in Rwanda.

YOUR ROLE:
- Understand what the user is looking for
- Search the business directory using location and category
- Provide relevant recommendations
- Help users connect with businesses
- Help users LIST their own products or services
- Automatically enroll users in the business directory when they list products/services

CAPABILITIES:
- Search businesses by category, location, name
- Get detailed business information
- Find businesses near a specific location
- Provide contact information
- **List products for sale** (auto-enrolls user in directory)
- **List services offered** (auto-enrolls user in directory)
- Add complete business listings

AUTOMATIC BUSINESS ENROLLMENT:
- When a user lists a product → Create product listing + enroll as business
- When a user lists a service → Create service listing + enroll as business
- User appears in search results immediately
- Source marked as 'user_generated'

GUIDELINES:
- Ask clarifying questions if the request is vague
- Prioritize businesses with complete information
- Provide 3-5 relevant results when possible
- Include key details: name, location, phone, category
- Be helpful and conversational
- Encourage users to list their own products/services
- Explain that listing automatically adds them to the business directory

TOOLS AVAILABLE:
- search_businesses: Find businesses by criteria
- get_business_details: Get full information about a business
- search_nearby: Find businesses near coordinates
- geocode_location: Convert address to coordinates
- list_product: List a product for sale (auto-enrolls user)
- list_service: List a service offering (auto-enrolls user)
- add_business: Add a complete business listing

Always provide helpful, accurate information based on the business directory.`;
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_businesses',
        description: 'Search for businesses by name, category, or location',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (name, category, or keyword)' },
            location: { type: 'string', description: 'City or area (e.g., "Kigali", "Musanze")' },
            category: { type: 'string', description: 'Business category (e.g., "pharmacy", "restaurant")' },
            limit: { type: 'number', description: 'Maximum results (default 5)' }
          }
        },
        execute: async (params) => {
          let query = this.supabase
            .from('business_directory')
            .select('id, name, category, city, address, phone, rating');

          if (params.query) {
            query = query.or(`name.ilike.%${params.query}%,category.ilike.%${params.query}%`);
          }

          if (params.location) {
            query = query.ilike('city', `%${params.location}%`);
          }

          if (params.category) {
            query = query.ilike('category', `%${params.category}%`);
          }

          query = query.limit(params.limit || 5);

          const { data, error } = await query;

          if (error) {
            return { error: error.message };
          }

          if (!data || data.length === 0) {
            return { message: 'No businesses found matching your criteria.' };
          }

          return {
            count: data.length,
            businesses: data.map(b => ({
              id: b.id,
              name: b.name,
              category: b.category,
              location: `${b.city}${b.address ? ', ' + b.address : ''}`,
              phone: b.phone,
              rating: b.rating
            }))
          };
        }
      },
      {
        name: 'get_business_details',
        description: 'Get detailed information about a specific business',
        parameters: {
          type: 'object',
          properties: {
            business_id: { type: 'string', description: 'Business ID' }
          },
          required: ['business_id']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('business_directory')
            .select('*')
            .eq('id', params.business_id)
            .single();

          if (error || !data) {
            return { error: 'Business not found' };
          }

          return {
            business: {
              name: data.name,
              category: data.category,
              description: data.description,
              address: data.address,
              city: data.city,
              phone: data.phone,
              email: data.email,
              website: data.website,
              rating: data.rating,
              hours: data.opening_hours
            }
          };
        }
      },
      {
        name: 'search_nearby',
        description: 'Find businesses near specific coordinates',
        parameters: {
          type: 'object',
          properties: {
            latitude: { type: 'number', description: 'Latitude' },
            longitude: { type: 'number', description: 'Longitude' },
            radius_km: { type: 'number', description: 'Search radius in kilometers (default 5)' },
            category: { type: 'string', description: 'Optional category filter' }
          },
          required: ['latitude', 'longitude']
        },
        execute: async (params) => {
          // Use PostGIS for spatial search
          const { data, error } = await this.supabase.rpc('search_businesses_nearby', {
            lat: params.latitude,
            lng: params.longitude,
            radius_km: params.radius_km || 5,
            category_filter: params.category || null
          });

          if (error) {
            return { error: error.message };
          }

          if (!data || data.length === 0) {
            return { message: 'No businesses found nearby.' };
          }

          return {
            count: data.length,
            businesses: data.map((b: any) => ({
              id: b.id,
              name: b.name,
              category: b.category,
              distance_km: b.distance_km,
              address: b.address,
              phone: b.phone
            }))
          };
        }
      },
      {
        name: 'geocode_location',
        description: 'Convert an address or place name to coordinates',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'Address or place name' }
          },
          required: ['address']
        },
        execute: async (params) => {
          // This would use Google Maps Geocoding API
          // For now, return mock data for Kigali
          const kigaliCoords = { latitude: -1.9536, longitude: 30.0606 };
          
          return {
            address: params.address,
            coordinates: kigaliCoords,
            message: 'Geocoding integration pending - using Kigali center coordinates'
          };
        }
      },
      {
        name: 'list_product',
        description: 'List a product for sale. User will be automatically enrolled in business directory.',
        parameters: {
          type: 'object',
          properties: {
            product_name: { type: 'string', description: 'Name of the product' },
            description: { type: 'string', description: 'Product description' },
            price: { type: 'number', description: 'Price in RWF' },
            category: { type: 'string', description: 'Product category (e.g., "Electronics", "Clothing", "Food")' },
            business_name: { type: 'string', description: 'Optional business name (defaults to user name)' },
            city: { type: 'string', description: 'City/location' }
          },
          required: ['product_name', 'category', 'city']
        },
        execute: async (params, context) => {
          try {
            // Auto-enroll user in business directory if not already enrolled
            const businessName = params.business_name || `${params.product_name} Seller`;
            
            // Check if user already has a business
            const { data: existing } = await this.supabase
              .from('business_directory')
              .select('id')
              .eq('phone', context.userId)
              .single();
            
            let businessId = existing?.id;
            
            if (!existing) {
              // Create business entry for user
              const { data: newBusiness, error: bizError } = await this.supabase
                .from('business_directory')
                .insert({
                  name: businessName,
                  category: params.category,
                  city: params.city,
                  phone: context.userId,
                  source: 'user_generated',
                  status: 'ACTIVE',
                  verified: false
                })
                .select('id')
                .single();
              
              if (bizError) {
                return { error: 'Failed to create business profile' };
              }
              
              businessId = newBusiness.id;
            }
            
            // Create product listing (if you have a products table)
            // For now, we'll add it to business description
            const productInfo = `\n\n📦 Product: ${params.product_name}\n💰 Price: ${params.price} RWF\n📝 ${params.description || ''}`;
            
            await this.supabase
              .from('business_directory')
              .update({
                description: productInfo
              })
              .eq('id', businessId);
            
            return {
              success: true,
              message: `✅ Product "${params.product_name}" listed successfully! You've been added to the business directory.`,
              business_id: businessId
            };
          } catch (error) {
            return { error: 'Failed to list product' };
          }
        }
      },
      {
        name: 'list_service',
        description: 'List a service offering. User will be automatically enrolled in business directory.',
        parameters: {
          type: 'object',
          properties: {
            service_name: { type: 'string', description: 'Name of the service' },
            description: { type: 'string', description: 'Service description' },
            price: { type: 'string', description: 'Price or rate (e.g., "5000 RWF/hour", "Negotiable")' },
            category: { type: 'string', description: 'Service category (e.g., "Plumbing", "IT Support", "Tutoring")' },
            business_name: { type: 'string', description: 'Optional business name (defaults to user name)' },
            city: { type: 'string', description: 'City/location where service is offered' }
          },
          required: ['service_name', 'category', 'city']
        },
        execute: async (params, context) => {
          try {
            // Auto-enroll user in business directory if not already enrolled
            const businessName = params.business_name || `${params.service_name} Services`;
            
            // Check if user already has a business
            const { data: existing } = await this.supabase
              .from('business_directory')
              .select('id')
              .eq('phone', context.userId)
              .single();
            
            let businessId = existing?.id;
            
            if (!existing) {
              // Create business entry for user
              const { data: newBusiness, error: bizError } = await this.supabase
                .from('business_directory')
                .insert({
                  name: businessName,
                  category: params.category,
                  city: params.city,
                  phone: context.userId,
                  source: 'user_generated',
                  status: 'ACTIVE',
                  verified: false
                })
                .select('id')
                .single();
              
              if (bizError) {
                return { error: 'Failed to create business profile' };
              }
              
              businessId = newBusiness.id;
            }
            
            // Add service info to business description
            const serviceInfo = `\n\n🛠️ Service: ${params.service_name}\n💰 Rate: ${params.price || 'Contact for pricing'}\n📝 ${params.description || ''}`;
            
            await this.supabase
              .from('business_directory')
              .update({
                description: serviceInfo
              })
              .eq('id', businessId);
            
            return {
              success: true,
              message: `✅ Service "${params.service_name}" listed successfully! You've been added to the business directory.`,
              business_id: businessId
            };
          } catch (error) {
            return { error: 'Failed to list service' };
          }
        }
      },
      {
        name: 'add_business',
        description: 'Add a complete business listing to the directory',
        parameters: {
          type: 'object',
          properties: {
            business_name: { type: 'string', description: 'Business name' },
            category: { type: 'string', description: 'Business category' },
            description: { type: 'string', description: 'Business description' },
            city: { type: 'string', description: 'City/location' },
            address: { type: 'string', description: 'Street address' },
            phone: { type: 'string', description: 'Contact phone number' },
            email: { type: 'string', description: 'Contact email' },
            website: { type: 'string', description: 'Website URL' }
          },
          required: ['business_name', 'category', 'city']
        },
        execute: async (params, context) => {
          try {
            const { data, error } = await this.supabase
              .from('business_directory')
              .insert({
                name: params.business_name,
                category: params.category,
                description: params.description,
                city: params.city,
                address: params.address,
                phone: params.phone || context.userId,
                email: params.email,
                website: params.website,
                source: 'user_generated',
                status: 'ACTIVE',
                verified: false,
                user_id: context.userId
              })
              .select('id')
              .single();
            
            if (error) {
              return { error: 'Failed to add business' };
            }
            
            return {
              success: true,
              message: `✅ Business "${params.business_name}" added successfully to the directory!`,
              business_id: data.id
            };
          } catch (error) {
            return { error: 'Failed to add business' };
          }
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
          parts: [{ text: "Understood. I am the Business Broker Agent. I'll help you find businesses and services in Rwanda." }],
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

export async function runBusinessBrokerAgent(ctx: RouterContext, query: string) {
  try {
    const agent = new BusinessBrokerAgent(ctx.supabase);
    const response = await agent.execute(query, { userId: ctx.from });
    await sendText(ctx.from, response);
    return true;
  } catch (error) {
    console.error("BusinessBrokerAgent error:", error);
    await sendText(ctx.from, "Business Broker is currently unavailable.");
    return false;
  }
}
