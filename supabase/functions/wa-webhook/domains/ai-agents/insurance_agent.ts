/**
 * Insurance AI Agent - Rebuilt with AI Core
 * Uses Gemini 2.5 Pro for insurance quotes, claims, and policy management
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
 * Insurance Agent
 * Handles motor, health, life, and property insurance
 */
export class InsuranceAgent {
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
    return `You are the easyMO Insurance AI Agent. You help users with insurance quotes, claims, and policy management in Rwanda.

YOUR ROLE:
- Provide insurance quotes (motor, health, life, property)
- Help file and track insurance claims
- Answer insurance questions
- Guide users through the insurance process

INSURANCE TYPES:
1. **Motor Insurance**
   - Third Party: Basic liability coverage
   - Comprehensive: Full coverage including theft, damage
   - Required: Vehicle details, driver info

2. **Health Insurance**
   - Individual and family plans
   - Hospital coverage, outpatient care
   - Required: Age, medical history

3. **Life Insurance**
   - Term life and whole life
   - Beneficiary designation
   - Required: Age, health status

4. **Property Insurance**
   - Home, business property
   - Fire, theft, natural disasters
   - Required: Property value, location

GUIDELINES:
- Collect necessary information before quoting
- Explain coverage clearly
- Be transparent about costs and exclusions
- Help with claims documentation
- Never guarantee claim approval

TOOLS AVAILABLE:
- get_motor_quote: Calculate motor insurance premium
- get_health_quote: Calculate health insurance premium
- submit_claim: File an insurance claim
- check_claim_status: Track claim progress
- get_policy_details: Retrieve policy information

Always be helpful, clear, and professional.`;
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'get_motor_quote',
        description: 'Get motor insurance quote based on vehicle and driver details',
        parameters: {
          type: 'object',
          properties: {
            vehicle_type: { type: 'string', description: 'Car, motorcycle, truck, etc.' },
            vehicle_value: { type: 'number', description: 'Vehicle value in RWF' },
            coverage_type: { type: 'string', enum: ['third_party', 'comprehensive'] },
            driver_age: { type: 'number', description: 'Driver age' },
            driver_experience: { type: 'number', description: 'Years of driving experience' }
          },
          required: ['vehicle_type', 'vehicle_value', 'coverage_type']
        },
        execute: async (params) => {
          // Calculate premium based on vehicle value and coverage
          let basePremium = params.vehicle_value * 0.05; // 5% base rate
          
          if (params.coverage_type === 'comprehensive') {
            basePremium *= 1.5; // 50% more for comprehensive
          }
          
          // Age factor
          if (params.driver_age && params.driver_age < 25) {
            basePremium *= 1.3; // 30% more for young drivers
          }
          
          // Experience discount
          if (params.driver_experience && params.driver_experience > 5) {
            basePremium *= 0.9; // 10% discount for experienced drivers
          }

          const annualPremium = Math.round(basePremium);
          const monthlyPremium = Math.round(annualPremium / 12);

          // Store quote in database
          const { data, error } = await this.supabase
            .from('insurance_requests')
            .insert({
              insurance_type: 'motor',
              coverage_type: params.coverage_type,
              vehicle_type: params.vehicle_type,
              vehicle_value: params.vehicle_value,
              annual_premium: annualPremium,
              monthly_premium: monthlyPremium,
              status: 'quoted'
            })
            .select()
            .single();

          return {
            quote_id: data?.id,
            coverage: params.coverage_type,
            annual_premium: annualPremium,
            monthly_premium: monthlyPremium,
            currency: 'RWF',
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          };
        }
      },
      {
        name: 'get_health_quote',
        description: 'Get health insurance quote',
        parameters: {
          type: 'object',
          properties: {
            age: { type: 'number', description: 'Insured person age' },
            plan_type: { type: 'string', enum: ['basic', 'standard', 'premium'] },
            family_size: { type: 'number', description: 'Number of family members' }
          },
          required: ['age', 'plan_type']
        },
        execute: async (params) => {
          const basePremiums = {
            basic: 50000,
            standard: 100000,
            premium: 200000
          };

          let annualPremium = basePremiums[params.plan_type as keyof typeof basePremiums];
          
          // Age factor
          if (params.age > 50) {
            annualPremium *= 1.5;
          } else if (params.age > 40) {
            annualPremium *= 1.2;
          }
          
          // Family discount
          if (params.family_size && params.family_size > 1) {
            annualPremium *= params.family_size * 0.8; // 20% discount per additional member
          }

          annualPremium = Math.round(annualPremium);
          const monthlyPremium = Math.round(annualPremium / 12);

          return {
            plan: params.plan_type,
            annual_premium: annualPremium,
            monthly_premium: monthlyPremium,
            currency: 'RWF',
            coverage: params.plan_type === 'premium' 
              ? 'Full hospital, outpatient, dental, vision'
              : params.plan_type === 'standard'
              ? 'Hospital and outpatient care'
              : 'Basic hospital coverage'
          };
        }
      },
      {
        name: 'submit_claim',
        description: 'Submit an insurance claim',
        parameters: {
          type: 'object',
          properties: {
            policy_number: { type: 'string', description: 'Policy number' },
            claim_type: { type: 'string', description: 'Type of claim (accident, theft, medical, etc.)' },
            incident_date: { type: 'string', description: 'Date of incident' },
            description: { type: 'string', description: 'Claim description' },
            estimated_amount: { type: 'number', description: 'Estimated claim amount' }
          },
          required: ['policy_number', 'claim_type', 'description']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('insurance_claims')
            .insert({
              policy_number: params.policy_number,
              claim_type: params.claim_type,
              incident_date: params.incident_date || new Date().toISOString(),
              description: params.description,
              estimated_amount: params.estimated_amount,
              status: 'submitted',
              submitted_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to submit claim. Please try again.' };
          }

          return {
            claim_id: data.id,
            status: 'submitted',
            message: 'Claim submitted successfully. You will receive updates via WhatsApp.',
            next_steps: 'Please upload supporting documents (photos, receipts, police report if applicable)'
          };
        }
      },
      {
        name: 'check_claim_status',
        description: 'Check the status of an insurance claim',
        parameters: {
          type: 'object',
          properties: {
            claim_id: { type: 'string', description: 'Claim ID' }
          },
          required: ['claim_id']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('insurance_claims')
            .select('*')
            .eq('id', params.claim_id)
            .single();

          if (error || !data) {
            return { error: 'Claim not found' };
          }

          return {
            claim_id: data.id,
            status: data.status,
            claim_type: data.claim_type,
            submitted_at: data.submitted_at,
            estimated_amount: data.estimated_amount,
            approved_amount: data.approved_amount,
            notes: data.notes
          };
        }
      },
      {
        name: 'get_policy_details',
        description: 'Get details of an insurance policy',
        parameters: {
          type: 'object',
          properties: {
            policy_number: { type: 'string', description: 'Policy number' }
          },
          required: ['policy_number']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('insurance_policies')
            .select('*')
            .eq('policy_number', params.policy_number)
            .single();

          if (error || !data) {
            return { error: 'Policy not found' };
          }

          return {
            policy_number: data.policy_number,
            type: data.insurance_type,
            coverage: data.coverage_type,
            premium: data.annual_premium,
            status: data.status,
            start_date: data.start_date,
            end_date: data.end_date
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
          parts: [{ text: "Understood. I am the Insurance Agent. I'll help you with insurance quotes, claims, and policy management." }],
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

export async function runInsuranceAgent(ctx: RouterContext, query: string) {
  try {
    const agent = new InsuranceAgent(ctx.supabase);
    const response = await agent.execute(query, { userId: ctx.from });
    await sendText(ctx.from, response);
    return true;
  } catch (error) {
    console.error("InsuranceAgent error:", error);
    await sendText(ctx.from, "Insurance Agent is currently unavailable.");
    return false;
  }
}
