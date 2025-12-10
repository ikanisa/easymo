import type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';
import { createClient } from '@supabase/supabase-js';
import { childLogger } from '@easymo/commons';
import OpenAI from 'openai';
import { logToolInvocation } from '../../observability';

const log = childLogger({ service: 'agents-jobs' });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class JobsAgent extends BaseAgent {
  name = 'jobs_agent';
  instructions = `You are a career coach for blue-collar workers. Build profiles from chat (skills, location). Match aggressively to verified gigs. Warn about scams (never ask for money). Follow up on interview status.

Guardrails & Policies:
- No unverified high-pay promises.
- Zero tolerance for "pay to apply" scams.
- Safety first: advise meeting in public places.
- Respect worker privacy; share details only with applied employers.`;

  tools: Tool[];

  constructor() {
    super();
    this.tools = this.defineTools();
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_gigs',
        description: 'Find jobs by role, location, salary, type (full-time/gig). Uses semantic search for best matching.',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Job title or role to search for' },
            location: { type: 'string', description: 'Location name (e.g., "Kigali", "Musanze")' },
            min_salary: { type: 'number', description: 'Minimum salary in RWF' },
            job_type: { type: 'string', enum: ['full-time', 'part-time', 'contract', 'gig'], description: 'Type of employment' },
            category: { type: 'string', description: 'Job category (e.g., "construction", "driving", "hospitality")' }
          },
          required: ['role']
        },
        execute: async (params, context: AgentContext) => {
          await logToolInvocation('search_gigs', context as any, params);
          
          try {
            // Build search query from role and other parameters
            const searchQuery = [
              params.role,
              params.location && `in ${params.location}`,
              params.category && params.category,
            ].filter(Boolean).join(' ');

            log.info({ searchQuery, params }, 'Searching jobs with semantic matching');

            // Generate embedding for semantic search
            const embeddingResponse = await openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: searchQuery,
            });
            const embedding = embeddingResponse.data[0].embedding;

            // Call match_job_listings RPC function
            const { data, error } = await supabase.rpc('match_job_listings', {
              query_embedding: embedding,
              match_threshold: 0.6, // Lower threshold for more results
              match_count: 10,
              filter: {},
            });

            if (error) {
              log.error({ error }, 'Failed to search jobs');
              throw new Error(`Job search failed: ${error.message}`);
            }

            // Filter by additional criteria
            let jobs = data || [];
            
            if (params.min_salary) {
              jobs = jobs.filter((job: any) => 
                job.salary_min && job.salary_min >= params.min_salary
              );
            }

            // Map to expected format
            const results = jobs.slice(0, 5).map((job: any) => ({
              id: job.id,
              title: job.title,
              description: job.description,
              company: job.posted_by || 'Company',
              salary: job.salary_min || 0,
              salary_max: job.salary_max,
              location: job.location,
              verified: job.verified !== false,
              similarity: job.similarity,
            }));

            log.info({ count: results.length }, 'Job search completed');

            return { jobs: results };
          } catch (error) {
            log.error({ error: String(error) }, 'Job search error');
            // Return empty results on error instead of crashing
            return { jobs: [], error: 'Failed to search jobs. Please try again.' };
          }
        }
      },
      {
        name: 'create_worker_profile',
        description: 'Build/Update CV from chat (skills, experience, certificates).',
        parameters: {
          type: 'object',
          properties: {
            skills: { type: 'array', items: { type: 'string' }, description: 'List of skills' },
            experience: { type: 'string', description: 'Work experience description' },
            location: { type: 'string', description: 'Preferred work location' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Job categories of interest' }
          },
          required: ['skills', 'location']
        },
        execute: async (params, context: AgentContext) => {
          try {
            const userId = context.userId;
            if (!userId) {
              return { error: 'User ID not found in context' };
            }

            // Insert or update job seeker profile
            const profileData = {
              user_id: userId,
              skills: params.skills,
              experience: params.experience || '',
              preferred_location: params.location,
              categories: params.categories || [],
              updated_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
              .from('job_seekers')
              .upsert(profileData, { onConflict: 'user_id' })
              .select()
              .single();

            if (error) {
              log.error({ error }, 'Failed to create/update worker profile');
              return { error: 'Failed to save profile' };
            }

            log.info({ userId }, 'Worker profile updated');
            return { profile_id: userId, status: 'updated', data };
          } catch (error) {
            log.error({ error: String(error) }, 'Worker profile error');
            return { error: 'Profile update failed' };
          }
        }
      },
      {
        name: 'verify_employer',
        description: 'Check employer trust score & reviews.',
        parameters: {
          type: 'object',
          properties: {
            employer_id: { type: 'string', description: 'Employer or company identifier' },
            job_id: { type: 'string', description: 'Optional job ID to verify employer for' }
          },
          required: ['employer_id']
        },
        execute: async (params, context) => {
          try {
            // Check if job is verified in database
            let verified = false;
            let jobData = null;

            if (params.job_id) {
              const { data } = await supabase
                .from('job_listings')
                .select('verified, posted_by, source_id, is_external')
                .eq('id', params.job_id)
                .single();
              
              jobData = data;
              verified = data?.verified === true;
            }

            // Calculate trust score based on verification status
            const trust_score = verified ? 95 : 70;

            log.info({ employer_id: params.employer_id, verified, trust_score }, 'Employer verification check');

            return { 
              employer_id: params.employer_id, 
              trust_score, 
              verified,
              is_external: jobData?.is_external || false,
              warnings: verified ? [] : ['Employer verification pending. Exercise caution.']
            };
          } catch (error) {
            log.error({ error: String(error) }, 'Employer verification error');
            return { employer_id: params.employer_id, trust_score: 50, verified: false, error: 'Verification check failed' };
          }
        }
      },
      {
        name: 'application_tracker',
        description: 'Manage applications: submit, check status, withdraw.',
        parameters: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'Job listing ID' },
            action: { type: 'string', enum: ['apply', 'status', 'withdraw'], description: 'Action to perform' }
          },
          required: ['job_id', 'action']
        },
        execute: async (params, context: AgentContext) => {
          try {
            const userId = context.userId;
            if (!userId) {
              return { error: 'User ID not found' };
            }

            if (params.action === 'apply') {
              // Create job match/application
              const { data, error } = await supabase
                .from('job_matches')
                .insert({
                  job_id: params.job_id,
                  user_id: userId,
                  status: 'applied',
                  applied_at: new Date().toISOString(),
                })
                .select()
                .single();

              if (error) {
                // Check if already applied
                if (error.code === '23505') {
                  return { job_id: params.job_id, status: 'already_applied', message: 'You have already applied to this job' };
                }
                log.error({ error }, 'Failed to submit application');
                return { error: 'Failed to submit application' };
              }

              log.info({ userId, job_id: params.job_id }, 'Job application submitted');
              return { job_id: params.job_id, status: 'applied', timestamp: Date.now() };

            } else if (params.action === 'status') {
              // Check application status
              const { data, error } = await supabase
                .from('job_matches')
                .select('status, applied_at, updated_at')
                .eq('job_id', params.job_id)
                .eq('user_id', userId)
                .single();

              if (error || !data) {
                return { job_id: params.job_id, status: 'not_applied' };
              }

              return { job_id: params.job_id, ...data };

            } else if (params.action === 'withdraw') {
              // Withdraw application
              const { error } = await supabase
                .from('job_matches')
                .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
                .eq('job_id', params.job_id)
                .eq('user_id', userId);

              if (error) {
                log.error({ error }, 'Failed to withdraw application');
                return { error: 'Failed to withdraw application' };
              }

              log.info({ userId, job_id: params.job_id }, 'Job application withdrawn');
              return { job_id: params.job_id, status: 'withdrawn', timestamp: Date.now() };
            }

            return { error: 'Invalid action' };
          } catch (error) {
            log.error({ error: String(error) }, 'Application tracker error');
            return { error: 'Operation failed' };
          }
        }
      },
      {
        name: 'salary_insights',
        description: 'Provide market rate ranges for specific roles based on actual job listings data.',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Job role or title' },
            location: { type: 'string', description: 'Optional location to filter by' },
            category: { type: 'string', description: 'Optional job category' }
          },
          required: ['role']
        },
        execute: async (params, context) => {
          try {
            // Query job listings for salary insights
            let query = supabase
              .from('job_listings')
              .select('pay_min, pay_max, currency, title')
              .eq('status', 'open')
              .not('pay_min', 'is', null)
              .ilike('title', `%${params.role}%`);

            if (params.location) {
              query = query.ilike('location', `%${params.location}%`);
            }

            if (params.category) {
              query = query.eq('category', params.category);
            }

            const { data, error } = await query.limit(50);

            if (error) {
              log.error({ error }, 'Failed to fetch salary insights');
              // Return generic ranges as fallback
              return { 
                role: params.role, 
                min: 100000, 
                max: 500000, 
                avg: 250000, 
                currency: 'RWF',
                note: 'Estimated range - actual data unavailable'
              };
            }

            if (!data || data.length === 0) {
              return { 
                role: params.role, 
                min: 150000, 
                max: 400000, 
                avg: 250000,
                currency: 'RWF',
                note: 'No specific data found - showing typical range'
              };
            }

            // Calculate statistics
            const salaries = data.map(job => job.pay_min).filter(s => s && s > 0);
            const min = Math.min(...salaries);
            const max = Math.max(...data.map(job => job.pay_max || job.pay_min).filter(s => s && s > 0));
            const avg = Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length);

            log.info({ role: params.role, min, max, avg, sample_size: data.length }, 'Salary insights calculated');

            return { 
              role: params.role, 
              min, 
              max, 
              avg,
              currency: data[0]?.currency || 'RWF',
              sample_size: data.length,
              location: params.location || 'Rwanda'
            };
          } catch (error) {
            log.error({ error: String(error) }, 'Salary insights error');
            return { 
              role: params.role, 
              min: 150000, 
              max: 400000, 
              avg: 250000,
              currency: 'RWF',
              error: 'Failed to calculate salary insights'
            };
          }
        }
      }
    ];
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    const context = input.context ?? { userId: input.userId };
    
    // Basic execution logic
    return {
      success: true,
      finalOutput: "I am the Jobs Agent. Looking for work?",
      data: {},
      toolsInvoked: [],
      duration: 0
    };
  }

  protected formatSingleOption(option: any): string {
    return `${option.title} at ${option.company} - ${option.salary} RWF`;
  }

  protected calculateScore(option: any, criteria: any): number {
    return 1;
  }
}
