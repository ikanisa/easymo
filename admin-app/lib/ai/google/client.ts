/**
 * Google AI Client Setup - Gemini and related services
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

import { AI_CONFIG } from '../config';
import type { HealthCheck } from '../types';

let geminiClient: GoogleGenerativeAI | null = null;

export const getGeminiClient = (): GoogleGenerativeAI => {
  if (!geminiClient) {
    const apiKey = AI_CONFIG.apiKeys.googleAI;
    
    if (apiKey === 'PLACEHOLDER_GOOGLE_AI_KEY') {
      throw new Error('Google AI API key not configured. Set GOOGLE_AI_API_KEY environment variable.');
    }

    geminiClient = new GoogleGenerativeAI(apiKey);
  }

  return geminiClient;
};

export const resetGeminiClient = (): void => {
  geminiClient = null;
};

export const healthCheckGemini = async (): Promise<HealthCheck> => {
  const start = Date.now();
  
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Simple test generation
    const result = await model.generateContent('Hi');
    const response = await result.response;
    
    if (!response.text()) {
      throw new Error('No response from Gemini');
    }
    
    return {
      provider: 'gemini',
      status: 'healthy',
      latency: Date.now() - start,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      provider: 'gemini',
      status: 'unavailable',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
};
