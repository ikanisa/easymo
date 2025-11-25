import { createClient, SupabaseClient } from '@supabase/supabase-js';

import type { AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';

export class SalesAgent extends BaseAgent {
  name = 'sales_agent';
  instructions = `You are a creative director for ad campaigns. Generate Sora-2 video scripts, catchy hooks, and localized copy. Track campaign performance. Upsell premium visibility.

Process:
1. Understand the user's product/service and target audience
2. Generate creative ad scripts with visual prompts for Sora-2
3. Help create and launch ad campaigns with budget tracking
4. Provide campaign performance analytics
5. Suggest A/B testing variations to optimize performance

Guardrails & Policies:
- No guaranteeing ROI/sales numbers.
- No offensive/political content in ads.
- Respect platform ad standards (length, format).
- Clear distinction between organic vs paid reach.
- Always recommend appropriate budget based on goals.`;

  tools: Tool[];
  private supabase: SupabaseClient;

  constructor() {
    super();
    this.tools = this.defineTools();
    
    // Initialize Supabase client
    // Server-side uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    // Client-side fallback uses NEXT_PUBLIC_SUPABASE_URL and SERVICE_ROLE_KEY
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn("SalesAgent: Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
    
    this.supabase = createClient(supabaseUrl || '', supabaseKey || '', {
      auth: { persistSession: false }
    });
    
    // Set model to Gemini
    this.model = 'gemini-1.5-flash';
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'generate_ad_script',
        description: 'Create 15s/30s video scripts for Sora-2. Input: product, audience, vibe.',
        parameters: {
          type: 'object',
          properties: {
            product_name: { type: 'string', description: 'Name of the product/service' },
            audience: { type: 'string', description: 'Target audience description' },
            vibe: { type: 'string', description: 'Tone/mood (e.g., professional, fun, inspiring)' },
            duration: { type: 'string', enum: ['15s', '30s'], description: 'Video duration' }
          },
          required: ['product_name', 'audience']
        },
        execute: async (params) => {
          const { product_name, audience, vibe = 'professional', duration = '30s' } = params;
          
          // Generate script using LLM
          const scriptPrompt = `Create a ${duration} video ad script for "${product_name}" targeting "${audience}" with a ${vibe} tone. Include:
1. Opening hook (first 3 seconds)
2. Main message
3. Call to action
4. Visual descriptions for each scene

Format as JSON with: { script: string, scenes: [{duration: string, visual: string, audio: string}], visual_prompts: string[] }`;

          try {
            const response = await this.runCompletion([
              { role: 'system', content: 'You are an expert video ad scriptwriter. Return only valid JSON.' },
              { role: 'user', content: scriptPrompt }
            ]);
            
            const content = response.choices[0].message.content || '';
            // Try to parse JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
            
            // Fallback structured response when JSON parsing fails
            return {
              script: content,
              visual_prompts: [
                `${product_name} product showcase with ${vibe} lighting`,
                `Happy ${audience} using ${product_name}`,
                `Brand logo with call to action`
              ]
            };
          } catch (error) {
            // Log the error for debugging but provide graceful fallback
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`LLM script generation failed: ${errorMessage}. Using template fallback.`);
            
            // Fallback to template-based script
            return {
              script: `[Opening] ${product_name} - Made for ${audience}\n[Middle] Experience the difference with ${product_name}\n[Close] Try it today!`,
              visual_prompts: [
                `${product_name} product in elegant setting`,
                `Person from ${audience} demographic smiling`,
                `Brand logo with contact info`
              ]
            };
          }
        }
      },
      {
        name: 'create_campaign',
        description: 'Create a new ad campaign in the database. Input: budget, duration, assets.',
        parameters: {
          type: 'object',
          properties: {
            campaign_name: { type: 'string', description: 'Campaign name' },
            product_name: { type: 'string', description: 'Product/service being advertised' },
            budget: { type: 'number', description: 'Total budget in RWF' },
            duration_days: { type: 'number', description: 'Campaign duration in days' },
            target_audience: { type: 'string', description: 'Target audience description' },
            ad_script: { type: 'string', description: 'Generated ad script' },
            visual_prompts: { type: 'array', items: { type: 'string' }, description: 'Sora-2 visual prompts' }
          },
          required: ['campaign_name', 'budget']
        },
        execute: async (params, context) => {
          const { 
            campaign_name, 
            product_name,
            budget, 
            duration_days = 7, 
            target_audience,
            ad_script,
            visual_prompts = []
          } = params;
          
          const userPhone = context?.userId || context?.userPhone;
          
          // Create campaign in database
          const { data, error } = await this.supabase
            .from('ad_campaigns')
            .insert({
              user_phone: userPhone,
              campaign_name,
              product_name,
              budget,
              duration_days,
              target_audience: { description: target_audience },
              ad_script,
              visual_prompts,
              status: 'draft'
            })
            .select('id, campaign_name, budget, status')
            .single();
          
          if (error) {
            console.error('Create campaign error:', error);
            // Fallback response
            return { 
              success: false,
              error: error.message,
              campaign_name,
              estimated_reach: Math.floor(budget / 50) // Rough estimate
            };
          }
          
          return { 
            success: true,
            campaign_id: data.id, 
            campaign_name: data.campaign_name,
            status: data.status, 
            budget: data.budget,
            estimated_reach: Math.floor(budget / 50),
            message: 'Campaign created as draft. Use activate_campaign to launch.'
          };
        }
      },
      {
        name: 'activate_campaign',
        description: 'Activate a draft campaign to start running.',
        parameters: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Campaign ID to activate' }
          },
          required: ['campaign_id']
        },
        execute: async (params) => {
          const { campaign_id } = params;
          
          const { error } = await this.supabase.rpc('update_campaign_status', {
            p_campaign_id: campaign_id,
            p_status: 'active'
          });
          
          if (error) {
            return { success: false, error: error.message };
          }
          
          return { 
            success: true, 
            campaign_id, 
            status: 'active',
            message: 'Campaign is now live!' 
          };
        }
      },
      {
        name: 'check_campaign_stats',
        description: 'Get views, clicks, conversions for a campaign.',
        parameters: {
          type: 'object',
          properties: {
            campaign_id: { type: 'string', description: 'Campaign ID' }
          },
          required: ['campaign_id']
        },
        execute: async (params) => {
          const { campaign_id } = params;
          
          // Get campaign stats using RPC
          const { data, error } = await this.supabase.rpc('get_campaign_stats', {
            p_campaign_id: campaign_id
          });
          
          if (error) {
            console.error('Get stats error:', error);
            // Fallback to direct query
            const { data: campaign } = await this.supabase
              .from('ad_campaigns')
              .select('*')
              .eq('id', campaign_id)
              .single();
            
            if (campaign) {
              return {
                campaign_id,
                campaign_name: campaign.campaign_name,
                views: campaign.views || 0,
                clicks: campaign.clicks || 0,
                conversions: campaign.conversions || 0,
                spend: campaign.spend || 0,
                budget: campaign.budget,
                status: campaign.status
              };
            }
            
            return { error: 'Campaign not found' };
          }
          
          return data;
        }
      },
      {
        name: 'list_my_campaigns',
        description: 'List all campaigns for the current user.',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed'], description: 'Filter by status' }
          }
        },
        execute: async (params, context) => {
          const userPhone = context?.userId || context?.userPhone;
          
          let query = this.supabase
            .from('ad_campaigns')
            .select('id, campaign_name, product_name, budget, spend, views, clicks, status, created_at')
            .eq('user_phone', userPhone)
            .order('created_at', { ascending: false });
          
          if (params?.status) {
            query = query.eq('status', params.status);
          }
          
          const { data, error } = await query.limit(10);
          
          if (error) {
            return { error: error.message, campaigns: [] };
          }
          
          return { campaigns: data || [] };
        }
      },
      {
        name: 'audience_targeting',
        description: 'Suggest optimal demographics/locations based on product category.',
        parameters: {
          type: 'object',
          properties: {
            product_category: { type: 'string', description: 'Product category (e.g., agriculture, tech, food)' }
          },
          required: ['product_category']
        },
        execute: async (params) => {
          const { product_category } = params;
          
          // Audience recommendations by category
          const audienceMap: Record<string, { recommended_audience: string[], locations: string[], age_range: string }> = {
            agriculture: {
              recommended_audience: ['Farmers in East Province', 'Agro-dealers', 'Agricultural cooperatives'],
              locations: ['Kayonza', 'Rwamagana', 'Nyagatare', 'Bugesera'],
              age_range: '25-55'
            },
            food: {
              recommended_audience: ['Restaurant owners', 'Food vendors', 'Catering services', 'Hotels'],
              locations: ['Kigali', 'Rubavu', 'Musanze', 'Huye'],
              age_range: '22-50'
            },
            tech: {
              recommended_audience: ['Business owners', 'Tech professionals', 'Startups', 'Students'],
              locations: ['Kigali', 'Kicukiro', 'Gasabo', 'Nyarugenge'],
              age_range: '18-40'
            },
            retail: {
              recommended_audience: ['Shop owners', 'Retailers', 'Distributors'],
              locations: ['Kigali', 'Muhanga', 'Rubavu', 'Huye'],
              age_range: '25-55'
            },
            transport: {
              recommended_audience: ['Drivers', 'Transport companies', 'Logistics providers'],
              locations: ['Kigali', 'Rubavu', 'Musanze', 'Nyamasheke'],
              age_range: '22-50'
            }
          };
          
          const defaultAudience = {
            recommended_audience: ['General consumers', 'Business owners', 'Young professionals'],
            locations: ['Kigali', 'Major cities'],
            age_range: '18-55'
          };
          
          const category = product_category.toLowerCase();
          const result = audienceMap[category] || defaultAudience;
          
          return {
            product_category,
            ...result,
            recommended_budget: 'RWF 50,000 - 200,000 per week',
            best_times: ['8:00-10:00 AM', '12:00-2:00 PM', '6:00-9:00 PM']
          };
        }
      },
      {
        name: 'ab_test_generator',
        description: 'Generate 2 variations of ad copy to test performance.',
        parameters: {
          type: 'object',
          properties: {
            base_copy: { type: 'string', description: 'Base ad copy to create variations from' },
            product_name: { type: 'string', description: 'Product name for context' }
          },
          required: ['base_copy']
        },
        execute: async (params) => {
          const { base_copy, product_name = 'your product' } = params;
          
          try {
            const response = await this.runCompletion([
              { role: 'system', content: 'You are an expert copywriter. Create 2 variations of the given ad copy. Return JSON: { variant_A: string, variant_B: string, test_hypothesis: string }' },
              { role: 'user', content: `Create 2 variations of this ad copy for "${product_name}": "${base_copy}"` }
            ]);
            
            const content = response.choices[0].message.content || '';
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
          } catch (error) {
            // Fallback variations
          }
          
          // Fallback variations
          return { 
            variant_A: base_copy.includes('!') 
              ? base_copy.replace('!', ' - Limited time offer!')
              : `${base_copy} - Don't miss out!`,
            variant_B: `🔥 ${base_copy.replace(/[.!]$/, '')} - Act now!`,
            test_hypothesis: 'Testing urgency vs emoji engagement'
          };
        }
      }
    ];
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    const startTime = Date.now();
    const context = input.context ?? { userId: input.userId };
    
    // 1. System Prompt
    const messages: any[] = [
      { role: 'system', content: this.instructions },
      { role: 'user', content: input.query }
    ];

    // 2. LLM Call (Loop for tool use)
    let finalOutput = "";
    const toolsInvoked: string[] = [];
    const MAX_TURNS = 5;

    for (let i = 0; i < MAX_TURNS; i++) {
      // Convert our Tool[] to OpenAI tool format
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
        messages.push(toolMessage); // Add assistant message with tool calls
        
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
          } catch (error) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify({ error: (error as Error).message })
            });
          }
        }
      } else {
        // No tool calls, final response
        finalOutput = toolMessage.content || "I'm ready to help you create effective ad campaigns!";
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
    return `Campaign: ${option.campaign_name} - Budget: ${option.budget} RWF\nStatus: ${option.status}\nViews: ${option.views || 0} | Clicks: ${option.clicks || 0}`;
  }

  protected calculateScore(option: any, criteria: any): number {
    // Score based on performance metrics
    const ctr = option.views > 0 ? (option.clicks / option.views) * 100 : 0;
    return ctr;
  }
}
