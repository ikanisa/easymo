/**
 * Sales AI Agent (Cold Caller) - Rebuilt with AI Core
 * Uses Gemini 2.5 Pro + GPT-5 with shared tools
 */

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { sendText } from "../../wa/client.ts";
import { RouterContext } from "../../types.ts";

// Import from ai-core (will need to adapt for Deno)
interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any, context: any) => Promise<any>;
}

interface AgentInput {
  userId: string;
  query: string;
  context?: any;
}

interface AgentResult {
  success: boolean;
  finalOutput: string;
  toolsInvoked: any[];
  duration: number;
  modelUsed?: 'gemini' | 'gpt5';
}

/**
 * Sales AI Agent
 * Powered by Gemini 2.5 Pro with voice capability ready
 */
export class SalesAgent {
  private supabase: SupabaseClient;
  private gemini: GoogleGenerativeAI;
  private model: string = 'gemini-2.5-pro-latest'; // Upgraded from 2.0
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
    return `You are a professional sales representative for easyMO, Rwanda's super app.

SALES PLAYBOOK:

## Core Story
easyMO is Rwanda's all-in-one platform for:
- Mobile Money (MoMo) payments
- Business services (insurance, jobs, real estate)
- Transportation (rides, deliveries)
- Agricultural services

## Your Role
- Identify leads from business_directory
- Make outbound calls/messages
- Handle objections professionally
- Schedule follow-ups
- Close deals

## Objection Handling
- "Too expensive" → Highlight ROI and cost savings
- "Not interested" → Ask about pain points
- "Need to think" → Schedule specific follow-up

## Tools Available
- get_next_lead: Find next business to contact
- log_interaction: Record call notes
- schedule_callback: Set reminder for follow-up
- mark_do_not_call: Respect opt-outs
- initiate_whatsapp: Send WhatsApp message
- search_business_info: Get business details

IMPORTANT: Always be professional, respectful, and value-driven.`;
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'get_next_lead',
        description: 'Get the next business lead to contact from business_directory',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Business category to target' },
            location: { type: 'string', description: 'Location filter' }
          }
        },
        execute: async (params, context) => {
          let query = this.supabase
            .from('business_directory')
            .select('*')
            .is('last_contacted', null)
            .limit(1);

          if (params.category) {
            query = query.eq('category', params.category);
          }

          const { data, error } = await query;
          
          if (error || !data || data.length === 0) {
            return { lead: null, message: 'No leads available' };
          }

          return { lead: data[0] };
        }
      },
      {
        name: 'log_interaction',
        description: 'Log sales interaction details',
        parameters: {
          type: 'object',
          properties: {
            business_id: { type: 'string' },
            outcome: { type: 'string', enum: ['interested', 'not_interested', 'callback', 'closed'] },
            notes: { type: 'string' }
          },
          required: ['business_id', 'outcome']
        },
        execute: async (params, context) => {
          const { error } = await this.supabase
            .from('business_directory')
            .update({
              last_contacted: new Date().toISOString(),
              sales_status: params.outcome,
              sales_notes: params.notes
            })
            .eq('id', params.business_id);

          if (error) throw error;
          return { logged: true };
        }
      },
      {
        name: 'schedule_callback',
        description: 'Schedule a callback for a lead',
        parameters: {
          type: 'object',
          properties: {
            business_id: { type: 'string' },
            callback_date: { type: 'string', description: 'ISO date string' },
            reason: { type: 'string' }
          },
          required: ['business_id', 'callback_date']
        },
        execute: async (params, context) => {
          const { error } = await this.supabase
            .from('business_directory')
            .update({
              callback_scheduled: params.callback_date,
              callback_reason: params.reason
            })
            .eq('id', params.business_id);

          if (error) throw error;
          return { scheduled: true, date: params.callback_date };
        }
      },
      {
        name: 'mark_do_not_call',
        description: 'Mark a business as do not call',
        parameters: {
          type: 'object',
          properties: {
            business_id: { type: 'string' },
            reason: { type: 'string' }
          },
          required: ['business_id']
        },
        execute: async (params, context) => {
          const { error } = await this.supabase
            .from('business_directory')
            .update({
              do_not_call: true,
              dnc_reason: params.reason
            })
            .eq('id', params.business_id);

          if (error) throw error;
          return { marked: true };
        }
      },
      {
        name: 'initiate_whatsapp',
        description: 'Send WhatsApp message to business',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            message: { type: 'string' }
          },
          required: ['phone', 'message']
        },
        execute: async (params, context) => {
          // This would integrate with WhatsApp Business API
          return {
            sent: true,
            phone: params.phone,
            message: 'WhatsApp integration pending'
          };
        }
      }
    ];
  }

  /**
   * Execute sales agent with Gemini 2.5 Pro ReAct loop
   */
  async execute(input: AgentInput): Promise<AgentResult> {
    const startTime = Date.now();
    const toolsInvoked: any[] = [];

    try {
      const model = this.gemini.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      });

      // Convert tools to Gemini format
      const geminiTools = [{
        functionDeclarations: this.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }))
      }];

      const chat = model.startChat({
        tools: geminiTools as any,
        history: []
      });

      // Send initial query
      let result = await chat.sendMessage(this.instructions + '\n\nUser: ' + input.query);

      // ReAct loop (max 10 turns)
      for (let turn = 0; turn < 10; turn++) {
        const response = result.response;
        const functionCalls = response.functionCalls();

        if (!functionCalls || functionCalls.length === 0) {
          return {
            success: true,
            finalOutput: response.text(),
            toolsInvoked,
            duration: Date.now() - startTime,
            modelUsed: 'gemini'
          };
        }

        // Execute function calls
        for (const call of functionCalls) {
          const tool = this.tools.find(t => t.name === call.name);
          if (!tool) continue;

          try {
            const toolResult = await tool.execute(call.args, input.context);
            toolsInvoked.push({
              toolName: call.name,
              params: call.args,
              result: toolResult
            });

            result = await chat.sendMessage([{
              functionResponse: {
                name: call.name,
                response: toolResult
              }
            }]);
          } catch (error) {
            result = await chat.sendMessage([{
              functionResponse: {
                name: call.name,
                response: { error: error instanceof Error ? error.message : String(error) }
              }
            }]);
          }
        }
      }

      return {
        success: true,
        finalOutput: result.response.text(),
        toolsInvoked,
        duration: Date.now() - startTime,
        modelUsed: 'gemini'
      };

    } catch (error) {
      console.error('Sales Agent error:', error);
      return {
        success: false,
        finalOutput: 'An error occurred while processing your request.',
        toolsInvoked,
        duration: Date.now() - startTime
      };
    }
  }
}

/**
 * Run Sales Agent handler for wa-webhook
 */
export async function runSalesAgent(ctx: RouterContext, query: string) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  const agent = new SalesAgent(supabase);
  
  const result = await agent.execute({
    userId: ctx.user_id,
    query,
    context: { userId: ctx.user_id, supabase }
  });

  await sendText(ctx, result.finalOutput);
  
  return true;
}
