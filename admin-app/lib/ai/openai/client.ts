/**
 * OpenAI Client Setup - Singleton pattern with error handling
 */

import OpenAI from 'openai';
import { AI_CONFIG } from '../config';
import type { HealthCheck } from '../types';

let openaiClient: OpenAI | null = null;

export const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    const apiKey = AI_CONFIG.apiKeys.openai;
    
    if (apiKey === 'PLACEHOLDER_OPENAI_KEY') {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }

    openaiClient = new OpenAI({
      apiKey,
      organization: AI_CONFIG.apiKeys.openaiOrg !== 'PLACEHOLDER_ORG_ID' 
        ? AI_CONFIG.apiKeys.openaiOrg 
        : undefined,
      timeout: AI_CONFIG.timeouts.completion,
      maxRetries: 2,
    });
  }

  return openaiClient;
};

export const resetOpenAIClient = (): void => {
  openaiClient = null;
};

export const healthCheckOpenAI = async (): Promise<HealthCheck> => {
  const start = Date.now();
  
  try {
    const client = getOpenAIClient();
    
    // Simple models list call to check API availability
    await client.models.list();
    
    return {
      provider: 'openai',
      status: 'healthy',
      latency: Date.now() - start,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      provider: 'openai',
      status: 'unavailable',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
};
