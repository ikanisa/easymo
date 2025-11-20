import { z } from 'zod';
import type { AgentDefinition } from '../../runner';
import type { AgentContext } from '../../types';

// Define tools for JobsAgent
const searchJobsTool = {
  name: 'searchJobs',
  description: 'Search for job listings based on criteria',
  parameters: z.object({
    query: z.string().describe('Search query (e.g. "driver", "cook")'),
    location: z.string().optional().describe('Location filter'),
    jobType: z.string().optional().describe('Job type (full_time, part_time, etc.)'),
  }),
  execute: async ({ query: _query, location, jobType }: { query: string; location?: string; jobType?: string }, _context: AgentContext) => {
    // TODO: Implement actual DB search using Supabase
    // For now, return mock data
    return {
      results: [
        {
          id: 'job-123',
          title: 'Truck Driver',
          company: 'Logistics Co.',
          location: location || 'Kigali',
          type: jobType || 'full_time',
          salary: '200,000 RWF',
        },
        {
          id: 'job-456',
          title: 'Warehouse Assistant',
          company: 'Retail Ltd.',
          location: location || 'Kigali',
          type: 'part_time',
          salary: '150,000 RWF',
        },
      ],
      count: 2,
    };
  },
};

const applyForJobTool = {
  name: 'applyForJob',
  description: 'Apply for a specific job',
  parameters: z.object({
    jobId: z.string().describe('ID of the job to apply for'),
    seekerName: z.string().describe('Name of the applicant'),
    experience: z.string().describe('Brief summary of experience'),
  }),
  execute: async ({ jobId, seekerName: _seekerName, experience: _experience }: { jobId: string; seekerName: string; experience: string }, _context: AgentContext) => {
    // TODO: Implement actual application submission
    return {
      success: true,
      applicationId: `app-${Date.now()}`,
      message: `Application submitted for job ${jobId}`,
    };
  },
};

export const JobsAgent: AgentDefinition = {
  name: 'JobsAgent',
  instructions: `You are a helpful job board assistant for EasyMO.
Your goal is to help users find and apply for jobs.

Capabilities:
- Search for jobs by keyword, location, and type.
- Help users apply for jobs by collecting their details.
- Answer questions about job listings.

Guidelines:
- Ask clarifying questions if the user's search is too broad.
- Present job listings in a clear, concise format.
- Encourage users to apply if they seem interested.
- Be professional and encouraging.`,
  model: 'gpt-4o',
  temperature: 0.7,
  tools: [searchJobsTool, applyForJobTool],
};
