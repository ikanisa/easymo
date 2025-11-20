/**
 * Tool: Vector Search
 * 
 * Performs semantic search using OpenAI embeddings and Supabase pgvector.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { z } from 'zod';
import { logToolInvocation } from '../observability';
import type { AgentContext } from '../types';

// Schema for vector search parameters
export const vectorSearchSchema = z.object({
  query: z.string().min(1).describe('The search query string'),
  collection: z.enum(['real_estate', 'jobs']).describe('The collection to search in'),
  limit: z.number().int().min(1).max(10).default(5).describe('Number of results to return'),
  filter: z.record(z.any()).optional().describe('Optional metadata filters'),
});

export type VectorSearchParams = z.infer<typeof vectorSearchSchema>;

// Initialize OpenAI client
// Note: In a real app, ensure OPENAI_API_KEY is set
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
// Note: Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Generate embeddings for a text string
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Execute vector search
 */
export async function executeVectorSearch(
  params: VectorSearchParams,
  context: AgentContext
): Promise<{ results: Record<string, unknown>[] }> {
  await logToolInvocation('VectorSearch', context, params);

  try {
    const embedding = await generateEmbedding(params.query);

    let rpcName = '';
    if (params.collection === 'real_estate') {
      rpcName = 'match_property_listings';
    } else if (params.collection === 'jobs') {
      rpcName = 'match_job_listings';
    } else {
      throw new Error(`Unsupported collection: ${params.collection}`);
    }

    const { data, error } = await supabase.rpc(rpcName, {
      query_embedding: embedding,
      match_threshold: 0.7, // Adjust threshold as needed
      match_count: params.limit,
      filter: params.filter || {},
    });

    if (error) {
      throw new Error(`Supabase RPC error: ${error.message}`);
    }

    return { results: data || [] };
  } catch (error) {
    console.error('Vector search error:', error);
    // Fallback or rethrow
    throw error;
  }
}

export const vectorSearchTool = {
  name: 'VectorSearch',
  description: 'Perform semantic search for Real Estate properties or Job listings',
  parameters: vectorSearchSchema,
  execute: executeVectorSearch,
};
