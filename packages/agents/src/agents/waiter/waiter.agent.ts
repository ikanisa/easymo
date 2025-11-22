import type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';

export class WaiterAgent extends BaseAgent {
  name = 'waiter_agent';
  instructions = `You are a virtual restaurant waiter on WhatsApp. Handle menu questions, orders, table bookings, upsell politely, and orchestrate MoMo payments & kitchen orders. Always ground answers in menu DB; if unsure, say you’ll check. Respond in user language and venue tone.

Guardrails & Policies:
- Domain-only (food, venue); no politics/health advice.
- Never invent menu items; never promise allergy safety, only describe ingredients.
- Double-confirm orders & payment amounts.
- Admin commands only from whitelisted numbers.`;

  tools: Tool[];

  constructor() {
    super();
    this.tools = this.defineTools();
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_menu_supabase',
        description: 'Search dishes with prices, tags (vegan, spicy, etc.), and availability. Ground all menu answers.',
        parameters: {
          type: 'object',
          properties: {
            restaurant_id: { type: 'string' },
            query: { type: 'string' },
            filters: { 
              type: 'object',
              properties: {
                vegan: { type: 'boolean' },
                spicy: { type: 'boolean' },
                halal: { type: 'boolean' }
              }
            }
          },
          required: ['restaurant_id', 'query']
        },
        execute: async (params, context) => {
          // Mock implementation for now
          return {
            items: [
              { id: '1', name: 'Grilled Tilapia', price: 5000, available: true, tags: ['halal'] },
              { id: '2', name: 'Matoke Stew', price: 3000, available: true, tags: ['vegan'] }
            ]
          };
        }
      },
      {
        name: 'deepsearch',
        description: 'Web / Deep Search for nutrition, general cuisine info, reviews; summarized back to model.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' }
          },
          required: ['query']
        },
        execute: async (params, context) => {
          return { summary: 'Nutritional info found...' };
        }
      },
      {
        name: 'momo_charge',
        description: 'Initiate MoMo payment; input: phone, amount, order_id; output: status, txn_id.',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            amount: { type: 'number' },
            order_id: { type: 'string' }
          },
          required: ['phone', 'amount', 'order_id']
        },
        execute: async (params, context) => {
          return { status: 'pending', txn_id: 'txn_123' };
        }
      },
      {
        name: 'send_order',
        description: 'Create kitchen ticket; update status; optionally notify staff WhatsApp group.',
        parameters: {
          type: 'object',
          properties: {
            order_details: { type: 'object' },
            table_number: { type: 'string' }
          },
          required: ['order_details']
        },
        execute: async (params, context) => {
          return { ticket_id: 'tkt_456', status: 'sent_to_kitchen' };
        }
      },
      {
        name: 'lookup_loyalty',
        description: 'Check loyalty points & tier.',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' }
          },
          required: ['user_id']
        },
        execute: async (params, context) => {
          return { points: 150, tier: 'Gold' };
        }
      },
      {
        name: 'book_table',
        description: 'Create reservation; return reservation_id & summary.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            time: { type: 'string' },
            party_size: { type: 'number' },
            name: { type: 'string' }
          },
          required: ['date', 'time', 'party_size', 'name']
        },
        execute: async (params, context) => {
          return { reservation_id: 'res_789', status: 'confirmed' };
        }
      }
    ];
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    const context = input.context ?? { userId: input.userId };
    
    // Basic implementation of execute loop would go here
    // For now, we'll just return a mock response or use the base class logic if we had a full LLM loop
    
    return {
      success: true,
      finalOutput: "I am the Waiter Agent. How can I help you today?",
      data: {},
      toolsInvoked: [],
      duration: 0
    };
  }

  protected formatSingleOption(option: any): string {
    return `Dish: ${option.name} - ${option.price} RWF`;
  }

  protected calculateScore(option: any, criteria: any): number {
    return 1;
  }
}
