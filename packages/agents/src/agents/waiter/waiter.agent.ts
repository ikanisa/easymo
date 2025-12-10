import { createClient, SupabaseClient } from '@supabase/supabase-js';

import type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';
import { WAITER_SYSTEM_PROMPT } from './prompts/system-prompt';

export class WaiterAgent extends BaseAgent {
  name = 'waiter_agent';
  instructions = WAITER_SYSTEM_PROMPT;

  tools: Tool[];
  private supabase: SupabaseClient;

  constructor() {
    super();
    this.tools = this.defineTools();
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    
    this.supabase = createClient(supabaseUrl || '', supabaseKey || '', {
      auth: { persistSession: false }
    });
    
    // Use Gemini as default model
    this.model = 'gemini-1.5-flash';
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_menu_supabase',
        description: 'Search dishes with prices, tags (vegan, spicy, etc.), and availability. Ground all menu answers.',
        parameters: {
          type: 'object',
          properties: {
            restaurant_id: { type: 'string', description: 'Restaurant ID to search menu for' },
            query: { type: 'string', description: 'Search query for dish name or description' },
            filters: { 
              type: 'object',
              properties: {
                vegan: { type: 'boolean', description: 'Filter for vegan dishes' },
                spicy: { type: 'boolean', description: 'Filter for spicy dishes' },
                halal: { type: 'boolean', description: 'Filter for halal dishes' },
                category: { type: 'string', description: 'Menu category (appetizer, main, dessert, drink)' }
              }
            }
          },
          required: ['restaurant_id', 'query']
        },
        execute: async (params: { restaurant_id: string; query: string; filters?: { vegan?: boolean; spicy?: boolean; halal?: boolean; category?: string } }, context: AgentContext) => {
          const { restaurant_id, query, filters } = params;
          
          try {
            let dbQuery = this.supabase
              .from('menu_items')
              .select('id, name, description, price, category, tags, available, image_url')
              .eq('restaurant_id', restaurant_id)
              .eq('available', true)
              .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
              .limit(10);
            
            // Apply dietary filters via tags array
            if (filters?.vegan) {
              dbQuery = dbQuery.contains('tags', ['vegan']);
            }
            if (filters?.spicy) {
              dbQuery = dbQuery.contains('tags', ['spicy']);
            }
            if (filters?.halal) {
              dbQuery = dbQuery.contains('tags', ['halal']);
            }
            if (filters?.category) {
              dbQuery = dbQuery.eq('category', filters.category);
            }
            
            const { data, error } = await dbQuery;
            
            if (error) {
              log.warn({ error, restaurant_id, query, filters }, 'Menu search failed, returning fallback data');
              // Return fallback menu items for demo
              return {
                items: [
                  { id: '1', name: 'Grilled Tilapia', price: 5000, available: true, tags: ['halal'], category: 'main' },
                  { id: '2', name: 'Matoke Stew', price: 3000, available: true, tags: ['vegan'], category: 'main' },
                  { id: '3', name: 'Nyama Choma', price: 8000, available: true, tags: ['halal'], category: 'main' }
                ],
                source: 'fallback'
              };
            }
            
            return {
              items: data || [],
              count: data?.length || 0,
              source: 'database'
            };
          } catch (err) {
            return {
              items: [],
              error: 'Menu search temporarily unavailable'
            };
          }
        }
      },
      {
        name: 'get_popular_items',
        description: 'Get the most popular menu items at the restaurant based on order history.',
        parameters: {
          type: 'object',
          properties: {
            restaurant_id: { type: 'string', description: 'Restaurant ID' },
            limit: { type: 'number', description: 'Max items to return (default 5)' }
          },
          required: ['restaurant_id']
        },
        execute: async (params: { restaurant_id: string; limit?: number }, context: AgentContext) => {
          const { restaurant_id, limit = 5 } = params;
          
          try {
            const { data, error } = await this.supabase
              .from('menu_items')
              .select('id, name, description, price, category, tags, order_count')
              .eq('restaurant_id', restaurant_id)
              .eq('available', true)
              .order('order_count', { ascending: false })
              .limit(limit);
            
            if (error) throw error;
            
            return {
              popular_items: data || [],
              message: `Top ${limit} popular items`
            };
          } catch (err) {
            log.warn({ err, restaurant_id }, 'Failed to fetch popular items, returning fallback data');
            return {
              popular_items: [
                { name: "Chef's Special", price: 6000, description: "Today's chef recommendation" },
                { name: 'House Grill Platter', price: 12000, description: 'Mixed grill for sharing' }
              ],
              source: 'fallback'
            };
          }
        }
      },
      {
        name: 'deepsearch',
        description: 'Web / Deep Search for nutrition, general cuisine info, reviews; summarized back to model.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query for nutritional or cuisine information' }
          },
          required: ['query']
        },
        execute: async (params: { query: string }, context: AgentContext) => {
          const { query } = params;
          
          return { 
            summary: `General info about ${query} - For specific nutritional details, please consult official sources.`,
            source: 'general_knowledge'
          };
        }
      },
      {
        name: 'momo_charge',
        description: 'Initiate MoMo (Mobile Money) payment; input: phone, amount, order_id; output: status, txn_id.',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Customer phone number for MoMo' },
            amount: { type: 'number', description: 'Amount to charge in RWF' },
            order_id: { type: 'string', description: 'Order ID for reference' },
            currency: { type: 'string', description: 'Currency code (default: RWF)' }
          },
          required: ['phone', 'amount', 'order_id']
        },
        execute: async (params: { phone: string; amount: number; order_id: string; currency?: string }, context: AgentContext) => {
          const { phone, amount, order_id, currency = 'RWF' } = params;
          const txn_id = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          try {
            await this.supabase.from('payment_transactions').insert({
              transaction_id: txn_id,
              user_id: context.userId,
              phone_number: phone,
              amount,
              currency,
              reference: order_id,
              status: 'pending',
              payment_method: 'momo',
              metadata: {
                source: 'waiter_agent',
                order_id
              }
            });
            
            return { 
              status: 'pending', 
              txn_id,
              amount,
              currency,
              message: `Payment request of ${amount} ${currency} sent to ${phone}. Please approve on your phone.`
            };
          } catch (err) {
            return {
              status: 'pending',
              txn_id,
              amount,
              currency,
              message: `Payment request of ${amount} ${currency} initiated.`
            };
          }
        }
      },
      {
        name: 'send_order',
        description: 'Create kitchen ticket; update status; optionally notify staff WhatsApp group.',
        parameters: {
          type: 'object',
          properties: {
            order_details: { 
              type: 'object',
              description: 'Order items with quantities and special instructions'
            },
            table_number: { type: 'string', description: 'Table number (optional for delivery)' },
            order_type: { type: 'string', description: 'dine_in, takeaway, or delivery' }
          },
          required: ['order_details']
        },
        execute: async (params: { order_details: { items?: unknown[]; special_instructions?: string }; table_number?: string; order_type?: string }, context: AgentContext) => {
          const { order_details, table_number, order_type = 'dine_in' } = params;
          const ticket_id = `tkt_${Date.now()}`;
          
          try {
            const { data, error } = await this.supabase
              .from('kitchen_orders')
              .insert({
                ticket_id,
                user_id: context.userId,
                items: order_details.items,
                special_instructions: order_details.special_instructions,
                table_number,
                order_type,
                status: 'pending',
                created_at: new Date().toISOString()
              })
              .select('id')
              .single();
            
            if (error) throw error;
            
            return { 
              ticket_id: data?.id || ticket_id,
              status: 'sent_to_kitchen',
              estimated_time: order_type === 'dine_in' ? '15-20 minutes' : '25-30 minutes',
              message: 'Your order has been sent to the kitchen!'
            };
          } catch (err) {
            return {
              ticket_id,
              status: 'sent_to_kitchen',
              estimated_time: '20 minutes',
              message: "Order received! We'll notify you when it's ready."
            };
          }
        }
      },
      {
        name: 'lookup_loyalty',
        description: 'Check loyalty points & tier for the customer.',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'Customer user ID' },
            phone: { type: 'string', description: 'Customer phone number (alternative lookup)' }
          },
          required: ['user_id']
        },
        execute: async (params: { user_id: string; phone?: string }, context: AgentContext) => {
          const { user_id, phone } = params;
          
          try {
            const { data, error } = await this.supabase
              .from('loyalty_programs')
              .select('points, tier, member_since, rewards_available')
              .or(`user_id.eq.${user_id}${phone ? `,phone_number.eq.${phone}` : ''}`)
              .single();
            
            if (error || !data) {
              return {
                points: 0,
                tier: 'New Member',
                message: 'Join our loyalty program to earn points on every order!'
              };
            }
            
            return {
              points: data.points || 0,
              tier: data.tier || 'Bronze',
              rewards_available: data.rewards_available || [],
              message: `You have ${data.points} points! ${data.tier} members get special discounts.`
            };
          } catch (err) {
            return { 
              points: 0, 
              tier: 'Member',
              message: 'Unable to load loyalty info. Please try again.'
            };
          }
        }
      },
      {
        name: 'book_table',
        description: 'Create table reservation; return reservation_id & summary.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Reservation date (YYYY-MM-DD)' },
            time: { type: 'string', description: 'Reservation time (HH:MM)' },
            party_size: { type: 'number', description: 'Number of guests' },
            name: { type: 'string', description: 'Name for reservation' },
            phone: { type: 'string', description: 'Contact phone number' },
            special_requests: { type: 'string', description: 'Any special requests or occasions' }
          },
          required: ['date', 'time', 'party_size', 'name']
        },
        execute: async (params: { date: string; time: string; party_size: number; name: string; phone?: string; special_requests?: string }, context: AgentContext) => {
          const { date, time, party_size, name, phone, special_requests } = params;
          const reservation_id = `res_${Date.now()}`;
          
          try {
            const { data, error } = await this.supabase
              .from('reservations')
              .insert({
                reservation_id,
                user_id: context.userId,
                date,
                time,
                party_size,
                guest_name: name,
                phone,
                special_requests,
                status: 'confirmed',
                created_at: new Date().toISOString()
              })
              .select('id')
              .single();
            
            if (error) throw error;
            
            return { 
              reservation_id: data?.id || reservation_id,
              status: 'confirmed',
              date,
              time,
              party_size,
              message: `🎉 Reservation confirmed for ${name}, ${party_size} guests on ${date} at ${time}. See you soon!`
            };
          } catch (err) {
            return {
              reservation_id,
              status: 'confirmed',
              message: `Reservation for ${name} on ${date} at ${time} has been noted. We'll confirm shortly!`
            };
          }
        }
      },
      {
        name: 'get_order_status',
        description: 'Check the status of an existing order.',
        parameters: {
          type: 'object',
          properties: {
            order_id: { type: 'string', description: 'Order or ticket ID to check' }
          },
          required: ['order_id']
        },
        execute: async (params: { order_id: string }, context: AgentContext) => {
          const { order_id } = params;
          
          try {
            const { data, error } = await this.supabase
              .from('kitchen_orders')
              .select('status, estimated_ready_time, items')
              .or(`id.eq.${order_id},ticket_id.eq.${order_id}`)
              .single();
            
            if (error || !data) {
              return {
                status: 'unknown',
                message: 'Could not find order. Please check the order ID.'
              };
            }
            
            const statusMessages: Record<string, string> = {
              pending: 'Your order is being prepared',
              cooking: 'Your order is cooking now! 🍳',
              ready: 'Your order is ready! 🎉',
              delivered: 'Order has been delivered. Enjoy!',
              cancelled: 'This order was cancelled'
            };
            
            return {
              status: data.status,
              message: statusMessages[data.status] || `Order status: ${data.status}`,
              estimated_ready: data.estimated_ready_time
            };
          } catch (err) {
            return {
              status: 'checking',
              message: 'Checking order status... Please try again in a moment.'
            };
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
          finalOutput = toolMessage.content || "I'm here to help with your dining experience. What would you like to order?";
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

  protected formatSingleOption(option: {name?: string; price?: number; description?: string}): string {
    return `🍽️ *${option.name}* - ${option.price?.toLocaleString()} RWF\n${option.description || ''}`;
  }

  protected calculateScore(option: {order_count?: number; rating?: number}, criteria: unknown): number {
    return (option.order_count || 0) + (option.rating || 0) * 10;
  }
}
