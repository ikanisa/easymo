/**
 * Google AI ADK (Agent Development Kit) Client
 * 
 * Official Google agent framework integration for EasyMO
 * Supports: Gemini models, Google Search, Google Maps, Code Execution
 * 
 * @see https://ai.google.dev/gemini-api/docs
 */

import { Content, GenerativeModel, GoogleGenerativeAI, Part,Tool } from "@google/generative-ai";

// ============================================================================
// TYPES
// ============================================================================

export interface ADKConfig {
  apiKey: string;
  defaultModel?: string;
  timeout?: number;
}

export interface GoogleAgentParams {
  name: string;
  instructions: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: GoogleTool[];
  enableGoogleSearch?: boolean;
  enableGoogleMaps?: boolean;
  enableCodeExecution?: boolean;
  responseSchema?: object;
}

export interface GoogleTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  images?: string[]; // Base64 encoded
}

export interface ChatResult {
  text: string;
  groundingMetadata?: {
    webSearchQueries?: string[];
    groundingChunks?: Array<{
      web?: { uri: string; title: string };
    }>;
  };
  functionCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
}

export interface GoogleAgent {
  id: string;
  name: string;
  model: GenerativeModel;
  instructions: string;
  tools: Tool[];
  chat: (messages: ChatMessage[]) => Promise<ChatResult>;
  stream: (messages: ChatMessage[]) => AsyncGenerator<string>;
}

// ============================================================================
// ADK CLIENT
// ============================================================================

export class GoogleADKClient {
  private genAI: GoogleGenerativeAI;
  private defaultModel: string;
  private agents: Map<string, GoogleAgent> = new Map();

  constructor(config: ADKConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.defaultModel = config.defaultModel ?? "gemini-2.0-flash-exp";
  }

  /**
   * Create a new Google AI agent
   */
  createAgent(params: GoogleAgentParams): GoogleAgent {
    const agentId = `agent-${params.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    
    // Build tools array
    const tools: Tool[] = [];
    
    // Add grounding tools
    if (params.enableGoogleSearch) {
      tools.push({ googleSearch: {} } as any);
    }
    if (params.enableGoogleMaps) {
      tools.push({ googleMaps: {} } as any);
    }
    if (params.enableCodeExecution) {
      tools.push({ codeExecution: {} } as any);
    }

    // Add function tools
    if (params.tools?.length) {
      tools.push({
        functionDeclarations: params.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      } as any);
    }

    // Create model
    const model = this.genAI.getGenerativeModel({
      model: params.model ?? this.defaultModel,
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxTokens ?? 8192,
        topP: 0.95,
      },
      systemInstruction: params.instructions,
      tools: tools.length > 0 ? tools : undefined,
    });

    const agent: GoogleAgent = {
      id: agentId,
      name: params.name,
      model,
      instructions: params.instructions,
      tools,
      chat: (messages) => this.chat(model, messages, params.instructions),
      stream: (messages) => this.streamChat(model, messages, params.instructions),
    };

    this.agents.set(agentId, agent);
    return agent;
  }

  /**
   * Get an existing agent
   */
  getAgent(agentId: string): GoogleAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Chat with a model
   */
  async chat(
    model: GenerativeModel,
    messages: ChatMessage[],
    _systemInstruction?: string
  ): Promise<ChatResult> {
    // Convert messages to Gemini format
    const contents: Content[] = messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: this.buildParts(m),
    }));

    // Start chat session
    const chat = model.startChat({
      history: contents.slice(0, -1),
    });

    // Send last message
    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(this.buildParts(lastMessage));

    const response = result.response;
    const text = response.text();

    return {
      text,
      groundingMetadata: (response.candidates?.[0] as any)?.groundingMetadata,
      functionCalls: response.functionCalls()?.map((fc) => ({
        name: fc.name,
        args: fc.args as Record<string, unknown>,
      })),
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            candidatesTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  }

  /**
   * Stream chat response
   */
  async *streamChat(
    model: GenerativeModel,
    messages: ChatMessage[],
    _systemInstruction?: string
  ): AsyncGenerator<string> {
    const contents: Content[] = messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: this.buildParts(m),
    }));

    const chat = model.startChat({
      history: contents.slice(0, -1),
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessageStream(this.buildParts(lastMessage));

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  /**
   * Generate content with vision (multimodal)
   */
  async generateWithVision(
    prompt: string,
    images: string[],
    model?: string
  ): Promise<string> {
    const genModel = this.genAI.getGenerativeModel({
      model: model ?? "gemini-2.0-flash-exp",
    });

    const parts: Part[] = [{ text: prompt }];
    
    for (const image of images) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: image,
        },
      });
    }

    const result = await genModel.generateContent(parts);
    return result.response.text();
  }

  /**
   * Generate with Google Search grounding
   */
  async generateWithSearch(
    prompt: string,
    options?: { model?: string }
  ): Promise<ChatResult> {
    const model = this.genAI.getGenerativeModel({
      model: options?.model ?? "gemini-2.0-flash-exp",
      tools: [{ googleSearch: {} } as any],
    });

    const result = await model.generateContent(prompt);
    const response = result.response;

    return {
      text: response.text(),
      groundingMetadata: (response.candidates?.[0] as any)?.groundingMetadata,
    };
  }

  /**
   * Generate with Google Maps grounding
   */
  async generateWithMaps(
    prompt: string,
    options?: { model?: string }
  ): Promise<ChatResult> {
    const model = this.genAI.getGenerativeModel({
      model: options?.model ?? "gemini-2.0-flash-exp",
      tools: [{ googleMaps: {} } as any],
    });

    const result = await model.generateContent(prompt);
    const response = result.response;

    return {
      text: response.text(),
      groundingMetadata: (response.candidates?.[0] as any)?.groundingMetadata,
    };
  }

  /**
   * Execute function calls and return results
   */
  async executeFunctionCalls(
    agent: GoogleAgent,
    functionCalls: Array<{ name: string; args: Record<string, unknown> }>,
    executor: (name: string, args: Record<string, unknown>) => Promise<unknown>
  ): Promise<ChatResult> {
    const results: Part[] = [];

    for (const call of functionCalls) {
      const result = await executor(call.name, call.args);
      results.push({
        functionResponse: {
          name: call.name,
          response: { result },
        },
      } as any);
    }

    const response = await agent.model.generateContent({
      contents: [{ role: "function", parts: results }],
    } as any);

    return {
      text: response.response.text(),
    };
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  private buildParts(message: ChatMessage): Part[] {
    const parts: Part[] = [{ text: message.content }];
    
    if (message.images?.length) {
      for (const image of message.images) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: image,
          },
        });
      }
    }
    
    return parts;
  }
}

export default GoogleADKClient;
