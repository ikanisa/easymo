/**
 * Waiter AI Agent - Rebuilt with AI Core
 * Uses Gemini 2.5 Pro for restaurant orders, menu queries, and reservations
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
import { AgentLocationHelper } from "./location-helper.ts";

interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any, context: any) => Promise<any>;
}

/**
 * Waiter Agent
 * Virtual restaurant waiter on WhatsApp
 */
export class WaiterAgent {
  private supabase: SupabaseClient;
  private gemini: GoogleGenerativeAI;
  private model: string = 'gemini-2.5-pro-latest';
  private tools: Tool[];
  private instructions: string;
  private locationHelper: AgentLocationHelper;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.locationHelper = new AgentLocationHelper(supabase);
    
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }
    this.gemini = new GoogleGenerativeAI(apiKey);
    
    this.instructions = this.buildInstructions();
    this.tools = this.defineTools();
  }

  private buildInstructions(): string {
    return `You are a virtual restaurant waiter on WhatsApp. Handle menu questions, orders, table bookings, and payments.

YOUR ROLE:
- Answer menu questions with accurate information
- Take food and drink orders
- Process MoMo payments
- Make table reservations
- Upsell politely (suggest drinks, desserts, specials)
- Handle dietary requirements and allergies

RESPONSE FORMAT (CRITICAL):
- ALWAYS use emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) when showing multiple items
- Keep messages concise and conversational
- Use emojis to make responses friendly (🍕, 🍔, ☕, etc.)
- When showing menu items, format as: "1️⃣ Item Name - Price RWF\\n   Brief description"
- End messages with clear next steps

GUIDELINES:
- Always ground answers in the menu database
- Never invent menu items or prices
- Double-confirm orders and payment amounts
- Ask about allergies and dietary restrictions
- Be polite and professional
- Respond in user's language

MENU CATEGORIES:
- Appetizers, Main Courses, Desserts
- Beverages (soft drinks, juices, alcohol)
- Specials and daily offers

GUARDRAILS:
- Domain-only (food, venue); no politics/health advice
- Never promise allergy safety, only describe ingredients
- Admin commands only from whitelisted numbers
- No medical or nutritional advice

TOOLS AVAILABLE:
- search_menu: Find dishes by name, category, dietary tags
- create_order: Create new order
- process_payment: Handle MoMo payment
- book_table: Reserve table
- check_availability: Check dish availability

Always be helpful, accurate, and customer-focused.`;
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_menu',
        description: 'Search menu items by name, category, or dietary tags',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            category: { type: 'string', description: 'Category filter (appetizer, main, dessert, beverage)' },
            dietary: { type: 'array', items: { type: 'string' }, description: 'Dietary tags (vegan, vegetarian, halal, gluten-free)' }
          }
        },
        execute: async (params) => {
          let query = this.supabase
            .from('restaurant_menu')
            .select('id, name, description, price, category, available, dietary_tags')
            .eq('available', true);

          if (params.query) {
            query = query.or(`name.ilike.%${params.query}%,description.ilike.%${params.query}%`);
          }

          if (params.category) {
            query = query.eq('category', params.category);
          }

          query = query.limit(10);

          const { data, error } = await query;

          if (error || !data || data.length === 0) {
            return { message: 'No menu items found matching your search.' };
          }

          return {
            items: data.map(item => ({
              id: item.id,
              name: item.name,
              description: item.description,
              price: `${item.price} RWF`,
              category: item.category,
              dietary_tags: item.dietary_tags
            }))
          };
        }
      },
      {
        name: 'create_order',
        description: 'Create a new food order',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            items: { 
              type: 'array', 
              items: {
                type: 'object',
                properties: {
                  menu_item_id: { type: 'string' },
                  quantity: { type: 'number' },
                  special_instructions: { type: 'string' }
                }
              }
            },
            delivery_address: { type: 'string' },
            order_type: { type: 'string', enum: ['dine_in', 'takeout', 'delivery'] }
          },
          required: ['user_id', 'items', 'order_type']
        },
        execute: async (params) => {
          // Calculate total
          let total = 0;
          for (const item of params.items) {
            const { data } = await this.supabase
              .from('restaurant_menu')
              .select('price')
              .eq('id', item.menu_item_id)
              .single();
            
            if (data) {
              total += data.price * item.quantity;
            }
          }

          const { data, error } = await this.supabase
            .from('restaurant_orders')
            .insert({
              user_id: params.user_id,
              items: params.items,
              total_amount: total,
              order_type: params.order_type,
              delivery_address: params.delivery_address,
              status: 'pending',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to create order' };
          }

          return {
            order_id: data.id,
            total: `${total} RWF`,
            status: 'pending',
            message: 'Order created. Please proceed to payment.'
          };
        }
      },
      {
        name: 'process_payment',
        description: 'Process MoMo payment for order',
        parameters: {
          type: 'object',
          properties: {
            order_id: { type: 'string' },
            phone_number: { type: 'string' },
            amount: { type: 'number' }
          },
          required: ['order_id', 'phone_number', 'amount']
        },
        execute: async (params) => {
          // Generate USSD code for MoMo payment
          const ussdCode = `*182*8*1*${params.amount}#`;
          
          return {
            payment_method: 'momo_ussd',
            ussd_code: ussdCode,
            amount: params.amount,
            instructions: `Please dial ${ussdCode} to complete payment of ${params.amount} RWF`,
            order_id: params.order_id
          };
        }
      },
      {
        name: 'book_table',
        description: 'Reserve a table at the restaurant',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            date: { type: 'string', description: 'Reservation date (ISO format)' },
            time: { type: 'string', description: 'Reservation time (HH:MM)' },
            party_size: { type: 'number', description: 'Number of guests' },
            special_requests: { type: 'string' }
          },
          required: ['user_id', 'date', 'time', 'party_size']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('restaurant_reservations')
            .insert({
              user_id: params.user_id,
              reservation_date: params.date,
              reservation_time: params.time,
              party_size: params.party_size,
              special_requests: params.special_requests,
              status: 'confirmed',
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to book table' };
          }

          return {
            reservation_id: data.id,
            date: params.date,
            time: params.time,
            party_size: params.party_size,
            status: 'confirmed',
            message: 'Table reserved successfully. See you soon!'
          };
        }
      },
      {
        name: 'check_availability',
        description: 'Check if specific menu items are available',
        parameters: {
          type: 'object',
          properties: {
            item_ids: { type: 'array', items: { type: 'string' } }
          },
          required: ['item_ids']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('restaurant_menu')
            .select('id, name, available')
            .in('id', params.item_ids);

          if (error || !data) {
            return { error: 'Failed to check availability' };
          }

          return {
            items: data.map(item => ({
              id: item.id,
              name: item.name,
              available: item.available
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
          parts: [{ text: "Welcome! I'm your virtual waiter. How can I help you today?" }],
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

export async function runWaiterAgent(ctx: RouterContext, query: string) {
  try {
    const agent = new WaiterAgent(ctx.supabase);
    const response = await agent.execute(query, { userId: ctx.from });
    await sendText(ctx.from, response);
    return true;
  } catch (error) {
    console.error("WaiterAgent error:", error);
    await sendText(ctx.from, "Waiter Agent is currently unavailable.");
    return false;
  }
}
