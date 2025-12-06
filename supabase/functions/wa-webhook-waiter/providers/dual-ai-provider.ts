/**
 * Dual AI Provider with Automatic Failover
 * Primary: OpenAI GPT-5 (for conversation/reasoning)
 * Fallback: Google Gemini-3 (for vision/OCR and as backup)
 * 
 * Per README.md: "Failover: If primary fails, automatically retry with backup"
 * 
 * Complies with:
 * - README.md: Mandatory LLM Providers section
 * - GROUND_RULES.md: Observability requirements
 */

import { logStructuredEvent } from "../../_shared/observability.ts";

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatConfig {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

interface ChatResponse {
  text: string;
  provider: 'openai' | 'gemini';
  model: string;
  fallbackUsed: boolean;
}

export class DualAIProvider {
  private openaiApiKey: string;
  private geminiApiKey: string;
  
  // Mandatory models per README.md
  private readonly PRIMARY_MODEL = 'gpt-5';  // OpenAI GPT-5
  private readonly FALLBACK_MODEL = 'gemini-3';  // Google Gemini-3
  
  private readonly OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
  private readonly GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    this.openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';
    this.geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';
    
    if (!this.openaiApiKey && !this.geminiApiKey) {
      throw new Error('At least one AI provider API key must be configured (OPENAI_API_KEY or GEMINI_API_KEY)');
    }
  }

  /**
   * Chat with automatic failover
   * Primary: OpenAI GPT-5
   * Fallback: Google Gemini-3
   */
  async chat(messages: Message[], config?: ChatConfig): Promise<ChatResponse> {
    const startTime = Date.now();
    
    // Try primary provider (OpenAI GPT-5) first
    if (this.openaiApiKey) {
      try {
        const text = await this.chatWithOpenAI(messages, config);
        
        await logStructuredEvent("AI_PROVIDER_USED", {
          provider: 'openai',
          model: this.PRIMARY_MODEL,
          fallbackUsed: false,
          latencyMs: Date.now() - startTime,
        });
        
        return {
          text,
          provider: 'openai',
          model: this.PRIMARY_MODEL,
          fallbackUsed: false,
        };
      } catch (error) {
        await logStructuredEvent("AI_PROVIDER_FAILURE", {
          provider: 'openai',
          model: this.PRIMARY_MODEL,
          error: error instanceof Error ? error.message : String(error),
          attemptingFailover: !!this.geminiApiKey,
        }, 'warn');
        
        console.warn('OpenAI GPT-5 failed, falling back to Gemini-3:', error);
      }
    }
    
    // Fallback to Gemini-3
    if (this.geminiApiKey) {
      try {
        const fallbackStartTime = Date.now();
        const text = await this.chatWithGemini(messages, config);
        
        await logStructuredEvent("AI_PROVIDER_USED", {
          provider: 'gemini',
          model: this.FALLBACK_MODEL,
          fallbackUsed: this.openaiApiKey ? true : false,
          latencyMs: Date.now() - fallbackStartTime,
          totalLatencyMs: Date.now() - startTime,
        });
        
        return {
          text,
          provider: 'gemini',
          model: this.FALLBACK_MODEL,
          fallbackUsed: this.openaiApiKey ? true : false,
        };
      } catch (error) {
        await logStructuredEvent("AI_PROVIDER_FAILURE", {
          provider: 'gemini',
          model: this.FALLBACK_MODEL,
          error: error instanceof Error ? error.message : String(error),
          totalFailure: true,
        }, 'error');
        
        console.error('Gemini-3 also failed:', error);
        throw error;
      }
    }
    
    throw new Error('All AI providers failed');
  }

  /**
   * OpenAI GPT-5 chat completion
   */
  private async chatWithOpenAI(messages: Message[], config?: ChatConfig): Promise<string> {
    const response = await fetch(this.OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.PRIMARY_MODEL,  // GPT-5 as per README
        messages: messages,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Google Gemini-3 chat completion
   */
  private async chatWithGemini(messages: Message[], config?: ChatConfig): Promise<string> {
    const url = `${this.GEMINI_ENDPOINT}/${this.FALLBACK_MODEL}:generateContent?key=${this.geminiApiKey}`;
    
    // Convert to Gemini format
    const contents = this.convertToGeminiFormat(messages);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: config?.temperature ?? 0.7,
          maxOutputTokens: config?.maxTokens ?? 2000,
          topP: 0.95,
          topK: 40,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Convert messages to Gemini format
   */
  private convertToGeminiFormat(messages: Message[]): any[] {
    const contents: any[] = [];
    let systemPrompt = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += msg.content + '\n\n';
      } else {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const content = msg.role === 'user' && systemPrompt
          ? systemPrompt + msg.content
          : msg.content;
        
        contents.push({
          role,
          parts: [{ text: content }],
        });

        if (systemPrompt) systemPrompt = '';
      }
    }

    return contents;
  }
}
