/**
 * Gemini AI Provider - Shared across all agents
 */

import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0';
import type { ConversationMessage } from '../base-agent.ts';

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export class GeminiProvider {
  private client: GoogleGenerativeAI;
  private defaultModel = 'gemini-2.0-flash-exp';

  constructor() {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY') || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Missing GOOGLE_AI_API_KEY or GEMINI_API_KEY');
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(
    messages: ConversationMessage[],
    options: ChatOptions = {}
  ): Promise<string> {
    const { temperature = 0.7, maxTokens = 800, model = this.defaultModel } = options;

    const genModel = this.client.getGenerativeModel({
      model,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    // Convert messages to Gemini format
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = chatMessages[chatMessages.length - 1];

    const chat = genModel.startChat({
      history,
      systemInstruction: systemMessage?.content,
    });

    const result = await chat.sendMessage(lastMessage?.content || '');
    return result.response.text();
  }
}
