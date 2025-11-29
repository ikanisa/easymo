/**
 * Unified Gateway
 * 
 * Routes requests to the appropriate AI provider based on:
 * - Request type (Q&A, reasoning, vision, voice, etc.)
 * - Cost/Performance requirements
 * - Availability/Health
 */

import GoogleADKClient from "../agents/google/adk-client";
import FlashLiteClient from "../agents/google/flash-lite";
import ImagenClient from "../agents/google/imagen";
import SearchGroundingClient from "../agents/google/search-grounding";
import RealtimeClient from "../agents/openai/realtime-client";
import OpenAIAgentsSDK from "../agents/openai/sdk-client";
// import GeminiLiveClient from "../agents/google/gemini-live";

export interface GatewayConfig {
  openaiApiKey: string;
  googleApiKey: string;
}

export type RequestType = 
  | "simple_qa" 
  | "complex_reasoning" 
  | "vision" 
  | "voice_realtime" 
  | "current_events" 
  | "image_generation" 
  | "code_execution";

export class UnifiedGateway {
  private openai: OpenAIAgentsSDK;
  private google: GoogleADKClient;
  private flashLite: FlashLiteClient;
  private searchGrounding: SearchGroundingClient;
  private imagen: ImagenClient;

  constructor(config: GatewayConfig) {
    this.openai = new OpenAIAgentsSDK({ apiKey: config.openaiApiKey });
    this.google = new GoogleADKClient({ apiKey: config.googleApiKey });
    this.flashLite = new FlashLiteClient({ apiKey: config.googleApiKey });
    this.searchGrounding = new SearchGroundingClient({ apiKey: config.googleApiKey });
    this.imagen = new ImagenClient({ apiKey: config.googleApiKey });
  }

  /**
   * Route a request to the best provider
   */
  async routeRequest(
    type: RequestType,
    params: any
  ): Promise<any> {
    switch (type) {
      case "simple_qa":
        // Primary: Flash-Lite (Google)
        // Fallback: GPT-4o-mini (OpenAI)
        try {
          return await this.flashLite.generateResponse(params.prompt);
        } catch (error) {
          console.warn("Flash-Lite failed, falling back to GPT-4o-mini", error);
          const assistant = await this.openai.createAssistant({
            name: "Fallback QA",
            instructions: "You are a helpful assistant.",
            model: "gpt-4o-mini",
          });
          const result = await this.openai.runAgent({
            assistantId: assistant.id,
            message: params.prompt,
          });
          return result.lastMessage;
        }

      case "complex_reasoning":
        // Primary: GPT-4o (OpenAI)
        // Fallback: Gemini Pro (Google)
        try {
          const assistant = await this.openai.createAssistant({
            name: "Reasoning Agent",
            instructions: "You are a helpful assistant capable of complex reasoning.",
            model: "gpt-4o",
          });
          const result = await this.openai.runAgent({
            assistantId: assistant.id,
            message: params.prompt,
          });
          return result.lastMessage;
        } catch (error) {
           console.warn("GPT-4o failed, falling back to Gemini Pro", error);
           const agent = this.google.createAgent({
             name: "Fallback Reasoning",
             instructions: "You are a helpful assistant.",
             model: "gemini-1.5-pro",
           });
           const result = await agent.chat([{ role: "user", content: params.prompt }]);
           return result.text;
        }

      case "vision":
        // Primary: Gemini (Google)
        // Fallback: GPT-4o Vision (OpenAI)
        try {
          return await this.google.generateWithVision(
            params.prompt,
            params.images
          );
        } catch (error) {
           // Fallback implementation for OpenAI Vision would go here
           throw error;
        }

      case "voice_realtime":
        // Primary: OpenAI Realtime
        // Fallback: Gemini Live
        // Note: Realtime clients are stateful and return the client instance
        return new RealtimeClient({ apiKey: (this.openai as any).client.apiKey });

      case "current_events":
        // Primary: Gemini + Google Search
        // Fallback: GPT-4o + Web Search
        try {
          return await this.searchGrounding.generateWithSearch(params.prompt);
        } catch (error) {
           // Fallback implementation
           throw error;
        }

      case "image_generation":
        // Primary: Imagen 3
        // Fallback: DALL-E 3
        try {
          return await this.imagen.generateImages(params);
        } catch (error) {
           // Fallback to DALL-E 3
           throw error;
        }

      default:
        throw new Error(`Unsupported request type: ${type}`);
    }
  }

  getOpenAIClient(): OpenAIAgentsSDK {
    return this.openai;
  }

  getGoogleClient(): GoogleADKClient {
    return this.google;
  }
}

export default UnifiedGateway;
