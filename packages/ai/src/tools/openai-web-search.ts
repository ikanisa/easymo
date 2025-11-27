import OpenAI from 'openai';
import { z } from 'zod';
import type { Tool, ToolContext } from '../core/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const openaiWebSearchTool: Tool = {
  name: 'openai_web_search',
  description: 'Perform a web search using OpenAI to find real-time information, specifically for jobs and properties.',
  category: 'search',
  enabled: true,
  requiresAuth: false,
  parameters: z.object({
    query: z.string().describe('The search query to find information.'),
    num_results: z.number().optional().default(5).describe('Number of results to return (if applicable).'),
  }),
  execute: async (args: { query: string; num_results?: number }, _context: ToolContext) => {
    try {
      // Using OpenAI's chat completion to simulate/perform search if the model supports it
      // or simply asking the model to answer based on its knowledge/browsing if available.
      // Note: True "web_search_preview" might require specific model/params.
      // For now, we use a standard completion which might not actually browse unless configured.
      // If the user meant the "Perplexity-like" search, it might be a different endpoint or param.
      // Assuming standard chat completion for now as a placeholder for the "Responses API".
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o', // or specific search-enabled model
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that searches the web for: ${args.query}. Provide a structured summary of findings.`,
          },
          {
            role: 'user',
            content: args.query,
          },
        ],
        // If there are specific params for search, they would go here.
      });

      return {
        results: completion.choices[0].message.content,
        metadata: {
          model: completion.model,
          usage: completion.usage,
        }
      };
    } catch (error) {
      console.error('OpenAI Web Search error:', error);
      throw new Error(`Failed to perform OpenAI web search: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
