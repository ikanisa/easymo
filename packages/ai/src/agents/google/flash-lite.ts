/**
 * Flash-Lite Client
 * 
 * Specialized client for lightning-fast responses using Gemini Flash models.
 * Optimized for:
 * - Low latency (<100ms targets)
 * - Auto-completion
 * - Intent classification
 * - Simple Q&A
 */

import { GenerativeModel,GoogleGenerativeAI } from "@google/generative-ai";

export interface FlashLiteConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
}

export interface IntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
}

export class FlashLiteClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(config: FlashLiteConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.model ?? "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: config.temperature ?? 0.3, // Lower temperature for faster/deterministic results
        maxOutputTokens: 1024,
      },
    });
  }

  /**
   * Generate a fast text response
   */
  async generateResponse(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Classify user intent
   */
  async classifyIntent(
    query: string,
    intents: string[]
  ): Promise<IntentResult> {
    const prompt = `
      Classify the following user query into one of these intents: ${intents.join(", ")}.
      Return a JSON object with "intent" (string), "confidence" (number 0-1), and "entities" (object of extracted entities).
      
      User Query: "${query}"
      
      JSON Response:
    `;

    const result = await this.model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });

    const text = result.response.text();
    return JSON.parse(text) as IntentResult;
  }

  /**
   * Auto-complete text
   */
  async autoComplete(prefix: string, _suffix?: string): Promise<string> {
    const prompt = `Complete the following text concisely:\n\n${prefix}`;
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}

export default FlashLiteClient;
