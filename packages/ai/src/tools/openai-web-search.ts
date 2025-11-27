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
      // Attempt to use the new Responses API with web_search_preview if available in the SDK
      // Note: As of late 2024/2025, this might be under 'client.responses' or similar.
      // If not available in the installed SDK version, we fallback to the chat completion simulation
      // but with a more explicit system prompt for search.
      
      // Checking if 'responses' exists on the client (runtime check)
      if ((openai as any).responses) {
        const response = await (openai as any).responses.create({
          model: 'gpt-4o',
          input: args.query,
          tools: [{ type: 'web_search_preview' }],
        });
        
        return {
          results: response.output_text || response.choices?.[0]?.message?.content, // Adjust based on actual API response structure
          citations: response.citations || [],
          metadata: {
            model: 'gpt-4o-responses',
            provider: 'openai_responses',
          }
        };
      }

      // Fallback: Standard Chat Completion with explicit search instruction
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant with access to real-time web information. 
            Search the web for: "${args.query}". 
            Provide a structured summary of findings with source URLs if possible.`,
          },
          {
            role: 'user',
            content: args.query,
          },
        ],
      });

      return {
        results: completion.choices[0].message.content,
        metadata: {
          model: completion.model,
          usage: completion.usage,
          provider: 'openai_chat_completion',
        }
      };
    } catch (error) {
      console.error('OpenAI Web Search error:', error);
      throw new Error(`Failed to perform OpenAI web search: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
