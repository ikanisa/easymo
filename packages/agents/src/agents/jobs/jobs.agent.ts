import type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';

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
        description: 'Find jobs by role, location, salary, type (full-time/gig).',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            location: { type: 'string' },
            min_salary: { type: 'number' }
          },
          required: ['role']
        },
        execute: async (params, context) => {
          // Mock implementation
          return { 
            jobs: [
              { id: 'j1', title: 'Driver', company: 'Logistics Co', salary: 200000, verified: true },
              { id: 'j2', title: 'Construction Worker', company: 'BuildIt', salary: 150000, verified: true }
            ]
          };
        }
      },
      {
        name: 'create_worker_profile',
        description: 'Build/Update CV from chat (skills, experience, certificates).',
        parameters: {
          type: 'object',
          properties: {
            skills: { type: 'array', items: { type: 'string' } },
            experience: { type: 'string' },
            location: { type: 'string' }
          },
          required: ['skills', 'location']
        },
        execute: async (params, context) => {
          return { profile_id: context.userId, status: 'updated' };
        }
      },
      {
        name: 'verify_employer',
        description: 'Check employer trust score & reviews.',
        parameters: {
          type: 'object',
          properties: {
            employer_id: { type: 'string' }
          },
          required: ['employer_id']
        },
        execute: async (params, context) => {
          return { employer_id: 'emp_123', trust_score: 95, verified: true };
        }
      },
      {
        name: 'application_tracker',
        description: 'Manage applications: submit, check status, withdraw.',
        parameters: {
          type: 'object',
          properties: {
            job_id: { type: 'string' },
            action: { type: 'string', enum: ['apply', 'status', 'withdraw'] }
          },
          required: ['job_id', 'action']
        },
        execute: async (params, context) => {
          return { job_id: 'j1', status: 'applied', timestamp: Date.now() };
        }
      },
      {
        name: 'salary_insights',
        description: 'Provide market rate ranges for specific roles.',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            location: { type: 'string' }
          },
          required: ['role']
        },
        execute: async (params, context) => {
          return { role: 'Driver', min: 150000, max: 300000, avg: 220000 };
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
