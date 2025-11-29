/**
 * Search Grounding Client
 * 
 * Google Search integration for real-time information.
 * Features:
 * - Real-time web search
 * - Citations and sources
 * - Fact-checking capabilities
 */

import { GenerativeModel,GoogleGenerativeAI } from "@google/generative-ai";

export interface SearchGroundingConfig {
  apiKey: string;
  model?: string;
}

export interface SearchResult {
  text: string;
  citations: Array<{
    uri: string;
    title: string;
    snippet?: string;
  }>;
  searchQueries: string[];
}

export class SearchGroundingClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(config: SearchGroundingConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.model ?? "gemini-2.0-flash-exp",
      tools: [{ googleSearch: {} } as any],
    });
  }

  /**
   * Generate content with Google Search grounding
   */
  async generateWithSearch(prompt: string): Promise<SearchResult> {
    const result = await this.model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const groundingMetadata = (response.candidates?.[0] as any)?.groundingMetadata;
    
    const citations = groundingMetadata?.groundingChunks
      ?.filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        uri: chunk.web.uri,
        title: chunk.web.title,
      })) ?? [];

    const searchQueries = groundingMetadata?.webSearchQueries ?? [];

    return {
      text,
      citations,
      searchQueries,
    };
  }

  /**
   * Fact check a statement using Google Search
   */
  async factCheck(statement: string): Promise<{
    isAccurate: boolean;
    explanation: string;
    sources: string[];
  }> {
    const prompt = `
      Fact check the following statement using Google Search.
      Statement: "${statement}"
      
      Return a JSON object with:
      - "isAccurate" (boolean)
      - "explanation" (string)
      - "sources" (array of URLs)
    `;

    const result = await this.model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });

    const text = result.response.text();
    return JSON.parse(text);
  }
}

export default SearchGroundingClient;
