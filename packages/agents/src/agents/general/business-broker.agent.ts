import { BaseAgent } from '../base/agent.base';
import type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';

export class BusinessBrokerAgent extends BaseAgent {
  name = 'business_broker_agent';
  instructions = `You are a local business discovery agent. Map user needs → business categories → specific nearby businesses. Always ask for location (pin or area) and urgency. Return a short, ranked list with reasons (open now, distance, rating).

Guardrails & Policies:
- No recommending illegal or restricted services.
- No medical advice beyond ‘pharmacy that stocks X’.
- Don't fabricate business availability; respect opening hours.
- No favoritism to partners unless transparently flagged.`;

  tools: Tool[];

  constructor() {
    super();
    this.tools = this.defineTools();
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_businesses',
        description: 'Find businesses by location/category. Input: user_location, category, tags; output: sorted businesses list with distance, opening hours, contact.',
        parameters: {
          type: 'object',
          properties: {
            user_location: { type: 'string' },
            category: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } }
          },
          required: ['user_location', 'category']
        },
        execute: async (params, context) => {
          // Mock implementation
          return { 
            businesses: [
              { name: 'Kigali Hardware', distance: '500m', open: true, rating: 4.5 },
              { name: 'City Pharmacy', distance: '1.2km', open: true, rating: 4.2 }
            ]
          };
        }
      },
      {
        name: 'maps_geocode',
        description: 'Convert area names ↔ coordinates; calculate distances & travel time.',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string' }
          },
          required: ['address']
        },
        execute: async (params, context) => {
          return { lat: -1.9441, lng: 30.0619, formatted_address: 'Kigali, Rwanda' };
        }
      },
      {
        name: 'business_details',
        description: 'Fetch full profile (services, MoMo QR, easyMO status) for a given business.',
        parameters: {
          type: 'object',
          properties: {
            business_id: { type: 'string' }
          },
          required: ['business_id']
        },
        execute: async (params, context) => {
          return { id: 'biz_123', name: 'Kigali Hardware', services: ['plumbing', 'electrical'], momo_qr: true };
        }
      }
    ];
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    const context = input.context ?? { userId: input.userId };
    
    // Basic execution logic
    return {
      success: true,
      finalOutput: "I am the Business Broker. I can help you find local businesses. Where are you located?",
      data: {},
      toolsInvoked: [],
      duration: 0
    };
  }

  protected formatSingleOption(option: any): string {
    return `${option.name} (${option.distance}) - ${option.open ? 'Open' : 'Closed'}`;
  }

  protected calculateScore(option: any, criteria: any): number {
    return 1;
  }
}

/**
 * Helper function to run BusinessBrokerAgent
 */
export async function runBusinessBrokerAgent(
  userId: string,
  query: string,
  context?: AgentContext
) {
  // This helper might need adjustment based on how the runner works, 
  // but keeping it consistent with previous pattern for now if needed.
  // However, the new pattern seems to be instantiating the class directly in the runner.
  // We'll export the class primarily.
  return new BusinessBrokerAgent();
}
