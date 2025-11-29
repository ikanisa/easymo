import { childLogger } from '@easymo/commons';
import { z } from 'zod';

import type { Tool, ToolContext } from '../core/types';

const log = childLogger({ service: 'ai' });

const SERPAPI_BASE = "https://serpapi.com/search.json";

export const serpapiJobsTool: Tool = {
  name: 'serpapi_google_jobs',
  description: 'Search for jobs using Google Jobs via SerpApi.',
  category: 'search',
  enabled: true,
  requiresAuth: false,
  parameters: z.object({
    query: z.string().describe('Job search query (e.g., "Software Engineer in Malta").'),
    location: z.string().optional().describe('Location for the job search.'),
    num_results: z.number().optional().default(10).describe('Number of jobs to return.'),
  }),
  execute: async (args: { query: string; location?: string; num_results?: number }, _context: ToolContext) => {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      throw new Error('SERPAPI_API_KEY is not set');
    }

    const params = new URLSearchParams({
      engine: 'google_jobs',
      q: args.query,
      api_key: apiKey,
      hl: 'en', // Host language
      gl: 'mt', // Geolocation (Malta default, can be dynamic)
    });

    if (args.location) {
      params.append('location', args.location);
    }

    try {
      const response = await fetch(`${SERPAPI_BASE}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`SerpApi request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      if (data.error) {
        throw new Error(`SerpApi error: ${data.error}`);
      }

      const jobs = data.jobs_results || [];
      return {
        jobs: jobs.slice(0, args.num_results).map((job: any) => ({
          title: job.title,
          company_name: job.company_name,
          location: job.location,
          description: job.description,
          via: job.via,
          extensions: job.extensions,
          job_id: job.job_id,
          apply_options: job.apply_options,
          thumbnail: job.thumbnail,
        })),
        total_results: jobs.length,
      };
    } catch (error) {
      log.error('SerpApi Jobs error:', error);
      throw new Error(`Failed to fetch jobs from SerpApi: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
