/**
 * Farmer AI Agent - Rebuilt with AI Core
 * Uses Gemini 2.5 Pro for agricultural services and marketplace
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
 * Farmer Agent
 * Agricultural marketplace and advisory services
 */
export class FarmerAgent {
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
    return `You are an agricultural assistant for farmers in Rwanda. Help with marketplace, advisory, and services.

YOUR ROLE:
- Connect farmers with buyers and sellers
- Provide agricultural advice
- Help list and sell produce
- Find agricultural services (equipment, labor, inputs)
- Share weather and market information

RESPONSE FORMAT (CRITICAL):
- ALWAYS use emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) when showing produce, services, or farmers
- Keep messages concise and conversational
- Use emojis: 🌱, 🚜, 🌾, 📦, 💰
- Format listings as: "1️⃣ Item/Farmer - Price/Details\\n   Additional info"
- End with clear call-to-action

SERVICES:
1. **Marketplace**
   - Buy/sell produce, livestock, seeds
   - Equipment rental
   - Agricultural inputs (fertilizer, pesticides)

2. **Advisory**
   - Crop selection and planning
   - Pest and disease management
   - Best practices and techniques

3. **Services**
   - Equipment rental (tractors, tillers)
   - Labor services
   - Transportation

GUIDELINES:
- Provide practical, Rwanda-specific advice
- Use local crop names and varieties
- Consider seasonal factors
- Promote sustainable practices
- Connect farmers directly

GUARDRAILS:
- No medical advice for humans
- No guarantees on yields or prices
- Verify buyer/seller legitimacy
- Respect farmer privacy

TOOLS AVAILABLE:
- search_marketplace: Find produce, equipment, inputs
- list_product: List produce or equipment for sale
- get_agricultural_advice: Get farming advice
- find_services: Find agricultural services
- check_market_prices: Get current market prices

Always be helpful, practical, and farmer-focused.`;
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_marketplace',
        description: 'Search agricultural marketplace for produce, equipment, or inputs',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['produce', 'livestock', 'equipment', 'inputs', 'seeds'] },
            product: { type: 'string', description: 'Product name or type' },
            location: { type: 'string', description: 'Location preference' }
          },
          required: ['category']
        },
        execute: async (params) => {
          let query = this.supabase
            .from('agricultural_marketplace')
            .select('id, title, category, price, unit, location, seller_contact, available')
            .eq('available', true);

          if (params.category) {
            query = query.eq('category', params.category);
          }

          if (params.product) {
            query = query.ilike('title', `%${params.product}%`);
          }

          if (params.location) {
            query = query.ilike('location', `%${params.location}%`);
          }

          query = query.limit(5);

          const { data, error } = await query;

          if (error || !data || data.length === 0) {
            return { message: 'No items found in the marketplace.' };
          }

          return {
            items: data.map(item => ({
              id: item.id,
              title: item.title,
              category: item.category,
              price: `${item.price} RWF per ${item.unit}`,
              location: item.location,
              contact: item.seller_contact
            }))
          };
        }
      },
      {
        name: 'list_product',
        description: 'List a product for sale in the marketplace',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            title: { type: 'string', description: 'Product title' },
            category: { type: 'string', enum: ['produce', 'livestock', 'equipment', 'inputs', 'seeds'] },
            price: { type: 'number', description: 'Price in RWF' },
            unit: { type: 'string', description: 'Unit (kg, bag, piece, etc.)' },
            quantity: { type: 'number' },
            location: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['user_id', 'title', 'category', 'price', 'unit']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('agricultural_marketplace')
            .insert({
              user_id: params.user_id,
              title: params.title,
              category: params.category,
              price: params.price,
              unit: params.unit,
              quantity: params.quantity,
              location: params.location,
              description: params.description,
              available: true,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to list product' };
          }

          return {
            listing_id: data.id,
            message: 'Product listed successfully in the marketplace',
            title: params.title,
            price: `${params.price} RWF per ${params.unit}`
          };
        }
      },
      {
        name: 'get_agricultural_advice',
        description: 'Get farming advice on crops, pests, or techniques',
        parameters: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Topic (crop selection, pest control, soil management, etc.)' },
            crop: { type: 'string', description: 'Specific crop if applicable' }
          },
          required: ['topic']
        },
        execute: async (params) => {
          // This would query a knowledge base or use LLM for advice
          return {
            topic: params.topic,
            advice: `For ${params.topic}${params.crop ? ' with ' + params.crop : ''}, consult with local agricultural extension officers for Rwanda-specific guidance. General best practices include proper soil preparation, timely planting, and integrated pest management.`,
            message: 'For detailed advice, contact your local agricultural extension office.'
          };
        }
      },
      {
        name: 'find_services',
        description: 'Find agricultural services (equipment rental, labor, transport)',
        parameters: {
          type: 'object',
          properties: {
            service_type: { type: 'string', enum: ['equipment_rental', 'labor', 'transport', 'veterinary'] },
            location: { type: 'string' }
          },
          required: ['service_type']
        },
        execute: async (params) => {
          let query = this.supabase
            .from('agricultural_services')
            .select('id, service_name, service_type, provider_name, location, contact, price_range')
            .eq('service_type', params.service_type);

          if (params.location) {
            query = query.ilike('location', `%${params.location}%`);
          }

          query = query.limit(5);

          const { data, error } = await query;

          if (error || !data || data.length === 0) {
            return { message: 'No services found matching your criteria.' };
          }

          return {
            services: data.map(s => ({
              id: s.id,
              name: s.service_name,
              provider: s.provider_name,
              location: s.location,
              contact: s.contact,
              price_range: s.price_range
            }))
          };
        }
      },
      {
        name: 'check_market_prices',
        description: 'Get current market prices for agricultural products',
        parameters: {
          type: 'object',
          properties: {
            product: { type: 'string', description: 'Product name' }
          },
          required: ['product']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('market_prices')
            .select('product, price_per_kg, market, date')
            .ilike('product', `%${params.product}%`)
            .order('date', { ascending: false })
            .limit(5);

          if (error || !data || data.length === 0) {
            return { message: 'No recent price data available for this product.' };
          }

          const avgPrice = Math.round(
            data.reduce((sum, p) => sum + p.price_per_kg, 0) / data.length
          );

          return {
            product: params.product,
            average_price: `${avgPrice} RWF/kg`,
            recent_prices: data.map(p => ({
              market: p.market,
              price: `${p.price_per_kg} RWF/kg`,
              date: p.date
            }))
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
          parts: [{ text: "Muraho! I'm your agricultural assistant. How can I help you today?" }],
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

export async function runFarmerAgent(ctx: RouterContext, query: string) {
  try {
    const agent = new FarmerAgent(ctx.supabase);
    const response = await agent.execute(query, { userId: ctx.from });
    await sendText(ctx.from, response);
    return true;
  } catch (error) {
    console.error("FarmerAgent error:", error);
    await sendText(ctx.from, "Farmer Agent is currently unavailable.");
    return false;
  }
}
