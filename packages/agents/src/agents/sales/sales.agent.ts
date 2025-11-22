import type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';

export class SalesAgent extends BaseAgent {
  name = 'sales_agent';
  instructions = `You are a creative director for ad campaigns. Generate Sora-2 video scripts, catchy hooks, and localized copy. Track campaign performance. Upsell premium visibility.

Guardrails & Policies:
- No guaranteeing ROI/sales numbers.
- No offensive/political content in ads.
- Respect platform ad standards (length, format).
- Clear distinction between organic vs paid reach.`;

  tools: Tool[];

  constructor() {
    super();
    this.tools = this.defineTools();
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'generate_ad_script',
        description: 'Create 15s/30s video scripts for Sora-2. Input: product, audience, vibe.',
        parameters: {
          type: 'object',
          properties: {
            product_name: { type: 'string' },
            audience: { type: 'string' },
            vibe: { type: 'string' },
            duration: { type: 'string', enum: ['15s', '30s'] }
          },
          required: ['product_name', 'audience']
        },
        execute: async (params, context) => {
          // Mock implementation
          return { 
            script: "Scene 1: Happy farmer... Voiceover: 'Grow more with X'...",
            visual_prompts: ["Farmer smiling in field", "Corn growing fast"]
          };
        }
      },
      {
        name: 'create_campaign',
        description: 'Launch ad campaign. Input: budget, duration, assets.',
        parameters: {
          type: 'object',
          properties: {
            campaign_name: { type: 'string' },
            budget: { type: 'number' },
            duration_days: { type: 'number' },
            target_audience: { type: 'string' }
          },
          required: ['campaign_name', 'budget']
        },
        execute: async (params, context) => {
          return { campaign_id: 'camp_123', status: 'active', estimated_reach: 5000 };
        }
      },
      {
        name: 'check_campaign_stats',
        description: 'Get views, clicks, conversions for active campaigns.',
        parameters: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string' }
          },
          required: ['campaign_id']
        },
        execute: async (params, context) => {
          return { views: 1200, clicks: 45, spend: 5000 };
        }
      },
      {
        name: 'audience_targeting',
        description: 'Suggest optimal demographics/locations based on product.',
        parameters: {
          type: 'object',
          properties: {
            product_category: { type: 'string' }
          },
          required: ['product_category']
        },
        execute: async (params, context) => {
          return { recommended_audience: ['Farmers in East Province', 'Agro-dealers'] };
        }
      },
      {
        name: 'ab_test_generator',
        description: 'Generate 2 variations of ad copy to test performance.',
        parameters: {
          type: 'object',
          properties: {
            base_copy: { type: 'string' }
          },
          required: ['base_copy']
        },
        execute: async (params, context) => {
          return { 
            variant_A: "Buy now for 20% off!",
            variant_B: "Limited time offer: Save big today!"
          };
        }
      }
    ];
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    const context = input.context ?? { userId: input.userId };
    
    // Basic execution logic
    return {
      success: true,
      finalOutput: "I am the Sales Agent. Ready to boost your business?",
      data: {},
      toolsInvoked: [],
      duration: 0
    };
  }

  protected formatSingleOption(option: any): string {
    return `Campaign: ${option.campaign_name} - Budget: ${option.budget}`;
  }

  protected calculateScore(option: any, criteria: any): number {
    return 1;
  }
}
