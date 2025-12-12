/**
 * Jobs AI Agent - Rebuilt with AI Core
 * Uses Gemini 2.5 Pro for job matching and career guidance
 */

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js";
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
import { googleSearch } from "shared/google_search.ts";
import { deepSearch } from "shared/deep_search.ts";

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

RESPONSE FORMAT (CRITICAL):
- ALWAYS use emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) when showing job opportunities
- Keep messages concise and conversational
- Use emojis: 💼, 🏗️, 🚗, 🍽️, 💰, ⏰
- Format job listings as: "1️⃣ Job Title - Company\\n   Salary, Location, Type"
- End with clear next steps for application

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
- web_search: Search for jobs on the web
- deep_search: Research career advice or specific companies

Always be supportive, honest, and safety-focused.`;
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_jobs',
        description: 'Search for jobs using AI-powered semantic matching. Understands natural language queries.',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Job role or title (e.g., "driver", "construction worker")' },
            location: { type: 'string', description: 'City or area' },
            min_salary: { type: 'number', description: 'Minimum salary in RWF' },
            job_type: { type: 'string', enum: ['full_time', 'part_time', 'contract', 'gig'], description: 'Employment type' },
            use_semantic_search: { type: 'boolean', description: 'Use AI semantic search (default: true)' }
          },
          required: ['role']
        },
        execute: async (params) => {
          try {
            // Use semantic search if enabled and OpenAI key available
            const useSemanticSearch = params.use_semantic_search !== false;
            const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

            if (useSemanticSearch && openaiApiKey) {
              // Build natural language query
              const searchQuery = [
                params.role,
                params.location && `in ${params.location}`,
                params.job_type && `${params.job_type} position`
              ].filter(Boolean).join(' ');

              console.log('Generating embedding for:', searchQuery);

              // Generate embedding
              const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${openaiApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "text-embedding-3-small",
                  input: searchQuery,
                }),
              });

              if (embeddingResponse.ok) {
                const embeddingData = await embeddingResponse.json();
                const embedding = embeddingData.data[0].embedding;

                // Call semantic search RPC
                const { data: semanticResults, error: rpcError } = await this.supabase.rpc('match_job_listings', {
                  query_embedding: embedding,
                  match_threshold: 0.6,
                  match_count: 10,
                  filter: {},
                });

                if (!rpcError && semanticResults && semanticResults.length > 0) {
                  // Apply additional filters
                  let filteredResults = semanticResults;

                  if (params.min_salary) {
                    filteredResults = filteredResults.filter((j: any) => 
                      j.salary_min && j.salary_min >= params.min_salary
                    );
                  }

                  if (filteredResults.length > 0) {
                    console.log(`Semantic search found ${filteredResults.length} matches`);
                    
                    return {
                      count: filteredResults.length,
                      search_type: 'semantic',
                      jobs: filteredResults.slice(0, 5).map((j: any) => ({
                        id: j.id,
                        title: j.title,
                        company: j.company || j.posted_by || 'Company',
                        location: j.location,
                        salary: `${j.salary_min} - ${j.salary_max} ${j.currency || 'RWF'}`,
                        type: j.job_type,
                        verified: j.verified || false,
                        match_score: Math.round((j.similarity || 0) * 100)
                      }))
                    };
                  }
                }

                console.log('Semantic search returned no results, falling back to keyword search');
              }
            }

            // Fallback to traditional keyword search
            console.log('Using traditional keyword search');
            let query = this.supabase
              .from('job_listings')
              .select('id, title, company, location, salary_min, salary_max, job_type, verified, description, currency, posted_by')
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
              return { message: 'No jobs found matching your criteria.', search_type: 'keyword' };
            }

            return {
              count: data.length,
              search_type: 'keyword',
              jobs: data.map(j => ({
                id: j.id,
                title: j.title,
                company: j.company || j.posted_by || 'Company',
                location: j.location,
                salary: `${j.salary_min} - ${j.salary_max} ${j.currency || 'RWF'}`,
                type: j.job_type,
                verified: j.verified || false
              }))
            };
          } catch (error) {
            console.error('Job search error:', error);
            return { message: 'Job search temporarily unavailable. Please try again.', error: String(error) };
          }
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
            .from('job_seekers')
            .upsert({
              user_id: params.user_id,
              skills: params.skills || [],
              experience: params.experience_years ? `${params.experience_years} years` : '',
              location: params.location,
              location_preference: params.location,
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
            experience: data.experience
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
            .from('job_matches')
            .insert({
              job_id: params.job_id,
              seeker_id: params.user_id,
              status: 'applied',
              score: 0.8,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            // Check if already applied (duplicate key error)
            if (error.code === '23505') {
              return { error: 'You have already applied to this job', status: 'duplicate' };
            }
            return { error: 'Failed to submit application' };
          }

          return {
            application_id: data.id,
            status: 'applied',
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
            .from('job_matches')
            .select('id, job_id, status, created_at, job_listings(title, company)')
            .eq('seeker_id', params.user_id)
            .order('created_at', { ascending: false })
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
              applied: a.created_at
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
      },
      {
        name: 'web_search',
        description: 'Search the web for jobs, career advice, or company info',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
          },
          required: ['query']
        },
        execute: async (params) => {
          const results = await googleSearch(params.query);
          return { results };
        }
      },
      {
        name: 'deep_search',
        description: 'Perform deep research on career topics, companies, or find niche jobs',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Research topic' }
          },
          required: ['query']
        },
        execute: async (params) => {
          const apiKey = Deno.env.get("GEMINI_API_KEY");
          if (!apiKey) return { error: "API key missing" };
          const answer = await deepSearch(params.query, apiKey);
          return { answer };
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
