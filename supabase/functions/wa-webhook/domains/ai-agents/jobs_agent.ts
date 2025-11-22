/**
 * Jobs AI Agent - Rebuilt with AI Core
 * Uses Gemini 2.5 Pro for job matching and career guidance
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
 * Jobs Agent
 * Career coach for blue-collar workers
 */
export class JobsAgent {
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
    return `You are a career coach for blue-collar workers in Rwanda. Help users find jobs, build profiles, and navigate the job market.

YOUR ROLE:
- Match workers to verified job opportunities
- Build worker profiles from conversations
- Provide career guidance and interview tips
- Warn about job scams
- Track application status

JOB CATEGORIES:
- Construction (mason, carpenter, plumber, electrician)
- Transportation (driver, moto taxi, delivery)
- Hospitality (waiter, chef, cleaner, security)
- Retail (shop attendant, cashier)
- Agriculture (farm worker, gardener)
- Domestic (housekeeper, nanny, cook)

GUARDRAILS:
- Never recommend unverified jobs
- Warn about "pay to apply" scams
- No high-pay promises without verification
- Advise meeting in public places
- Respect worker privacy

TOOLS AVAILABLE:
- search_jobs: Find jobs by role, location, salary
- create_worker_profile: Build/update worker profile
- apply_to_job: Submit job application
- check_application_status: Track applications
- get_salary_insights: Get salary ranges for roles

Always be supportive, honest, and safety-focused.`;
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_jobs',
        description: 'Search for jobs by role, location, and salary requirements',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Job role or title' },
            location: { type: 'string', description: 'City or area' },
            min_salary: { type: 'number', description: 'Minimum salary in RWF' },
            job_type: { type: 'string', enum: ['full_time', 'part_time', 'contract', 'gig'] }
          },
          required: ['role']
        },
        execute: async (params) => {
          let query = this.supabase
            .from('job_listings')
            .select('id, title, company, location, salary_min, salary_max, job_type, verified, description')
            .eq('status', 'active');

          if (params.role) {
            query = query.ilike('title', `%${params.role}%`);
          }

          if (params.location) {
            query = query.ilike('location', `%${params.location}%`);
          }

          if (params.min_salary) {
            query = query.gte('salary_min', params.min_salary);
          }

          if (params.job_type) {
            query = query.eq('job_type', params.job_type);
          }

          query = query.limit(5);

          const { data, error } = await query;

          if (error || !data || data.length === 0) {
            return { message: 'No jobs found matching your criteria.' };
          }

          return {
            count: data.length,
            jobs: data.map(j => ({
              id: j.id,
              title: j.title,
              company: j.company,
              location: j.location,
              salary: `${j.salary_min} - ${j.salary_max} RWF`,
              type: j.job_type,
              verified: j.verified
            }))
          };
        }
      },
      {
        name: 'create_worker_profile',
        description: 'Create or update worker profile',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            experience_years: { type: 'number' },
            location: { type: 'string' },
            preferred_roles: { type: 'array', items: { type: 'string' } }
          },
          required: ['user_id']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('worker_profiles')
            .upsert({
              user_id: params.user_id,
              skills: params.skills || [],
              experience_years: params.experience_years || 0,
              location: params.location,
              preferred_roles: params.preferred_roles || [],
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to create profile' };
          }

          return {
            profile_id: data.id,
            message: 'Profile created successfully',
            skills: data.skills,
            experience: data.experience_years
          };
        }
      },
      {
        name: 'apply_to_job',
        description: 'Submit job application',
        parameters: {
          type: 'object',
          properties: {
            job_id: { type: 'string' },
            user_id: { type: 'string' },
            cover_message: { type: 'string' }
          },
          required: ['job_id', 'user_id']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('job_applications')
            .insert({
              job_id: params.job_id,
              user_id: params.user_id,
              cover_message: params.cover_message,
              status: 'submitted',
              applied_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to submit application' };
          }

          return {
            application_id: data.id,
            status: 'submitted',
            message: 'Application submitted successfully. The employer will contact you if interested.'
          };
        }
      },
      {
        name: 'check_application_status',
        description: 'Check status of job applications',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' }
          },
          required: ['user_id']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('job_applications')
            .select('id, job_id, status, applied_at, job_listings(title, company)')
            .eq('user_id', params.user_id)
            .order('applied_at', { ascending: false })
            .limit(5);

          if (error || !data || data.length === 0) {
            return { message: 'No applications found' };
          }

          return {
            applications: data.map(a => ({
              id: a.id,
              job: (a as any).job_listings?.title,
              company: (a as any).job_listings?.company,
              status: a.status,
              applied: a.applied_at
            }))
          };
        }
      },
      {
        name: 'get_salary_insights',
        description: 'Get salary ranges for specific roles',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string' }
          },
          required: ['role']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('job_listings')
            .select('salary_min, salary_max')
            .ilike('title', `%${params.role}%`)
            .not('salary_min', 'is', null);

          if (error || !data || data.length === 0) {
            return { message: 'No salary data available for this role' };
          }

          const salaries = data.map(j => (j.salary_min + j.salary_max) / 2);
          const avgSalary = Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length);
          const minSalary = Math.min(...data.map(j => j.salary_min));
          const maxSalary = Math.max(...data.map(j => j.salary_max));

          return {
            role: params.role,
            average_salary: avgSalary,
            salary_range: `${minSalary} - ${maxSalary} RWF`,
            sample_size: data.length
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
          parts: [{ text: "Understood. I am your career coach. I'll help you find jobs and build your career." }],
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

export async function runJobsAgent(ctx: RouterContext, query: string) {
  try {
    const agent = new JobsAgent(ctx.supabase);
    const response = await agent.execute(query, { userId: ctx.from });
    await sendText(ctx.from, response);
    return true;
  } catch (error) {
    console.error("JobsAgent error:", error);
    await sendText(ctx.from, "Jobs Agent is currently unavailable.");
    return false;
  }
}
