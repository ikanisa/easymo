/**
 * Fast Response Optimization using Gemini Flash-Lite
 * 
 * Use for:
 * - Auto-completes
 * - Simple Q&A
 * - Quick confirmations
 * - Instant suggestions
 * 
 * Cost: $0.000075/1K tokens (75x cheaper than GPT-4o)
 * Latency: ~200ms average
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Temporary console logging until @easymo/commons is available
const log = {
  info: (msg: string) => console.log('[fast-response]', msg),
  debug: (msg: any, text: string) => console.log('[fast-response]', text, msg),
  error: (msg: any, text: string) => console.error('[fast-response]', text, msg),
  warn: (msg: any, text: string) => console.warn('[fast-response]', text, msg),
};

export interface FastResponseConfig {
  apiKey: string;
  defaultMaxTokens?: number;
  temperature?: number;
}

export interface FastResponseOptions {
  maxTokens?: number;
  temperature?: number;
  context?: string; // Optional context for better responses
}

export class GeminiFastResponse {
  private gemini: GoogleGenerativeAI;
  private config: FastResponseConfig;
  private model: any;

  constructor(config: FastResponseConfig) {
    this.config = {
      defaultMaxTokens: 256,
      temperature: 0.1, // Low temperature for deterministic, fast responses
      ...config,
    };

    this.gemini = new GoogleGenerativeAI(config.apiKey);
    this.model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-flash-lite-latest',
      generationConfig: {
        maxOutputTokens: this.config.defaultMaxTokens,
        temperature: this.config.temperature,
      },
    });

    log.info('Gemini Fast Response initialized with Flash-Lite');
  }

  /**
   * Get instant response for simple queries
   * 
   * @example
   * ```ts
   * const response = await fastResponse.instant("What is the capital of Rwanda?");
   * // "Kigali"
   * ```
   */
  async instant(prompt: string, options?: FastResponseOptions): Promise<string> {
    const startTime = Date.now();

    try {
      const result = await this.model.generateContent({
        contents: options?.context 
          ? `${options.context}\n\nUser: ${prompt}`
          : prompt,
        generationConfig: {
          maxOutputTokens: options?.maxTokens || this.config.defaultMaxTokens,
          temperature: options?.temperature ?? this.config.temperature,
        },
      });

      const responseText = result.response.text();
      const latency = Date.now() - startTime;

      log.debug({ latency, prompt: prompt.substring(0, 50) }, 'Fast response completed');

      return responseText;
    } catch (error) {
      log.error({ error, prompt }, 'Fast response failed');
      throw error;
    }
  }

  /**
   * Auto-complete user input
   * 
   * @example
   * ```ts
   * const suggestion = await fastResponse.autocomplete("I need to find a");
   * // "pharmacy near me"
   * ```
   */
  async autocomplete(partialText: string): Promise<string> {
    const prompt = `Complete this text naturally: "${partialText}"
    
    Rules:
    - Return ONLY the completion, not the original text
    - Keep it short (max 10 words)
    - Make it contextually relevant
    `;

    return await this.instant(prompt, { maxTokens: 50, temperature: 0.3 });
  }

  /**
   * Quick yes/no or classification
   * 
   * @example
   * ```ts
   * const isUrgent = await fastResponse.classify(
   *   "My car broke down on the highway",
   *   ["urgent", "normal", "low_priority"]
   * );
   * // "urgent"
   * ```
   */
  async classify(text: string, categories: string[]): Promise<string> {
    const prompt = `Classify this text into ONE of these categories: ${categories.join(', ')}
    
    Text: "${text}"
    
    Return ONLY the category name, nothing else.`;

    const response = await this.instant(prompt, { maxTokens: 20, temperature: 0 });
    
    // Find best match from categories
    const normalized = response.toLowerCase().trim();
    const match = categories.find(cat => normalized.includes(cat.toLowerCase()));
    
    return match || categories[0];
  }

  /**
   * Extract structured data quickly
   * 
   * @example
   * ```ts
   * const data = await fastResponse.extractJSON(
   *   "I need 2 bottles of water and 3 sodas",
   *   { items: "array of {name, quantity}" }
   * );
   * // { items: [{ name: "water", quantity: 2 }, { name: "soda", quantity: 3 }] }
   * ```
   */
  async extractJSON<T = any>(text: string, schema: Record<string, string>): Promise<T> {
    const schemaDesc = Object.entries(schema)
      .map(([key, desc]) => `"${key}": ${desc}`)
      .join(', ');

    const prompt = `Extract information from this text as JSON.

    Schema: { ${schemaDesc} }
    Text: "${text}"
    
    Return ONLY valid JSON, no markdown, no explanation.`;

    const response = await this.instant(prompt, { maxTokens: 512, temperature: 0 });
    
    // Clean up response
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/```$/, '');
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      log.error({ error, response: jsonStr }, 'Failed to parse JSON from fast response');
      throw new Error(`Invalid JSON from fast response: ${jsonStr}`);
    }
  }

  /**
   * Sentiment analysis
   */
  async sentiment(text: string): Promise<'positive' | 'negative' | 'neutral'> {
    return await this.classify(text, ['positive', 'negative', 'neutral']) as any;
  }

  /**
   * Language detection
   */
  async detectLanguage(text: string): Promise<string> {
    const prompt = `What language is this text? Return ONLY the language code (e.g., "en", "rw", "fr").
    
    Text: "${text}"`;

    return await this.instant(prompt, { maxTokens: 10, temperature: 0 });
  }

  /**
   * Batch processing for multiple prompts
   */
  async batch(prompts: string[], options?: FastResponseOptions): Promise<string[]> {
    return await Promise.all(prompts.map(p => this.instant(p, options)));
  }
}

/**
 * Singleton instance for convenience
 */
let fastResponseInstance: GeminiFastResponse | null = null;

export function initializeFastResponse(config: FastResponseConfig): GeminiFastResponse {
  fastResponseInstance = new GeminiFastResponse(config);
  return fastResponseInstance;
}

export function getFastResponse(): GeminiFastResponse {
  if (!fastResponseInstance) {
    throw new Error('Fast response not initialized. Call initializeFastResponse() first.');
  }
  return fastResponseInstance;
}
