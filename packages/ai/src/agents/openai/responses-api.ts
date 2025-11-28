/**
 * OpenAI Responses API Implementation
 * 
 * Uses the new Responses API for:
 * - Structured JSON output with schemas
 * - Built-in tools (web_search, file_search, code_interpreter, image_generation)
 * - Reasoning models support
 * - Streaming responses
 */

import OpenAI from "openai";
import { z } from "zod";

// ============================================================================
// TYPES
// ============================================================================

export interface ResponseMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ResponseTool {
  type: "web_search" | "file_search" | "code_interpreter" | "image_generation" | "function";
  // For web_search
  searchContextSize?: "low" | "medium" | "high";
  userLocation?: { type: "approximate"; city?: string; country?: string };
  // For file_search
  vectorStoreIds?: string[];
  maxResults?: number;
  // For image_generation
  quality?: "low" | "medium" | "high";
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  // For function
  function?: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface ResponseParams {
  messages: ResponseMessage[];
  model?: string;
  tools?: ResponseTool[];
  responseSchema?: object;
  enableReasoning?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: Record<string, string>;
}

export interface ResponseResult {
  text: string;
  structuredOutput?: Record<string, unknown>;
  toolCalls?: Array<{
    type: string;
    result: unknown;
  }>;
  citations?: Array<{
    title: string;
    url: string;
  }>;
  images?: string[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
}

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const AgentResponseSchema = {
  type: "json_schema",
  json_schema: {
    name: "agent_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        reply: { 
          type: "string", 
          description: "The agent's response text" 
        },
        suggestions: {
          type: "array",
          items: { type: "string" },
          description: "Quick reply suggestions for the user",
        },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              payload: { type: "object" },
            },
            required: ["type"],
          },
          description: "Actions to execute",
        },
        data: {
          type: "object",
          description: "Structured data extracted or generated",
        },
      },
      required: ["reply"],
      additionalProperties: false,
    },
  },
} as const;

// ============================================================================
// RESPONSES API CLIENT
// ============================================================================

export class OpenAIResponsesAPI {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel = "gpt-4o") {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
  }

  /**
   * Create a response using the Responses API
   */
  async createResponse(params: ResponseParams): Promise<ResponseResult> {
    const model = params.model ?? this.defaultModel;

    // Build tools array
    const tools = this.buildTools(params.tools);

    // Build input messages
    const input = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Create response
    const response = await (this.client as any).responses.create({
      model,
      input,
      tools: tools.length > 0 ? tools : undefined,
      text: params.responseSchema
        ? { format: params.responseSchema }
        : undefined,
      reasoning: params.enableReasoning
        ? { effort: params.reasoningEffort ?? "medium" }
        : undefined,
      temperature: params.temperature,
      max_output_tokens: params.maxTokens,
      metadata: params.metadata,
      stream: params.stream,
    });

    return this.parseResponse(response, model);
  }

  /**
   * Create a streaming response
   */
  async *createStreamingResponse(
    params: ResponseParams
  ): AsyncGenerator<{ type: "text" | "done"; content: string }> {
    const model = params.model ?? this.defaultModel;
    const tools = this.buildTools(params.tools);
    const input = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const stream = await (this.client as any).responses.create({
      model,
      input,
      tools: tools.length > 0 ? tools : undefined,
      text: params.responseSchema
        ? { format: params.responseSchema }
        : undefined,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        yield { type: "text", content: event.delta };
      } else if (event.type === "response.completed") {
        yield { type: "done", content: "" };
      }
    }
  }

  /**
   * Quick response with structured output
   */
  async structuredResponse<T extends z.ZodSchema>(
    prompt: string,
    schema: T,
    systemPrompt?: string
  ): Promise<z.infer<T>> {
    const messages: ResponseMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await this.createResponse({
      messages,
      responseSchema: {
        type: "json_schema",
        json_schema: {
          name: "structured_output",
          strict: true,
          schema: this.zodToJsonSchema(schema),
        },
      },
    });

    const parsed = JSON.parse(response.text);
    return schema.parse(parsed);
  }

  /**
   * Response with web search grounding
   */
  async searchGroundedResponse(
    query: string,
    options?: {
      location?: { city?: string; country?: string };
      contextSize?: "low" | "medium" | "high";
    }
  ): Promise<ResponseResult> {
    return this.createResponse({
      messages: [{ role: "user", content: query }],
      tools: [
        {
          type: "web_search",
          searchContextSize: options?.contextSize ?? "medium",
          userLocation: options?.location
            ? { type: "approximate", ...options.location }
            : undefined,
        },
      ],
    });
  }

  /**
   * Response with image generation
   */
  async generateImageResponse(
    prompt: string,
    options?: {
      quality?: "low" | "medium" | "high";
      size?: "1024x1024" | "1024x1536" | "1536x1024";
    }
  ): Promise<ResponseResult> {
    return this.createResponse({
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "image_generation",
          quality: options?.quality ?? "medium",
          size: options?.size ?? "1024x1024",
        },
      ],
    });
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  private buildTools(tools?: ResponseTool[]): object[] {
    if (!tools?.length) return [];

    return tools.map((tool) => {
      switch (tool.type) {
        case "web_search":
          return {
            type: "web_search_preview",
            search_context_size: tool.searchContextSize ?? "medium",
            user_location: tool.userLocation,
          };

        case "file_search":
          return {
            type: "file_search",
            vector_store_ids: tool.vectorStoreIds,
            max_num_results: tool.maxResults ?? 5,
          };

        case "code_interpreter":
          return { type: "code_interpreter" };

        case "image_generation":
          return {
            type: "image_generation",
            quality: tool.quality ?? "medium",
            size: tool.size ?? "1024x1024",
          };

        case "function":
          return {
            type: "function",
            function: tool.function,
          };

        default:
          return { type: tool.type };
      }
    });
  }

  private parseResponse(response: any, model: string): ResponseResult {
    const result: ResponseResult = {
      text: "",
      model,
    };

    // Extract text output
    for (const item of response.output ?? []) {
      if (item.type === "message") {
        for (const part of item.content ?? []) {
          if (part.type === "output_text") {
            result.text = part.text;
          }
        }
      }
    }

    // Try to parse as structured output
    if (result.text) {
      try {
        result.structuredOutput = JSON.parse(result.text);
      } catch {
        // Not JSON, keep as plain text
      }
    }

    // Extract tool calls and results
    result.toolCalls = [];
    for (const item of response.output ?? []) {
      if (item.type === "web_search_call") {
        result.citations = item.action?.sources?.map((s: any) => ({
          title: s.title,
          url: s.url,
        }));
      } else if (item.type === "image_generation_call") {
        result.images = item.result?.images?.map((img: any) => img.url);
      }
    }

    // Extract usage
    if (response.usage) {
      result.usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens,
      };
    }

    return result;
  }

  private zodToJsonSchema(schema: z.ZodSchema): object {
    // Simplified Zod to JSON Schema conversion
    // In production, use a library like zod-to-json-schema
    const shape = (schema as any)._def?.shape?.();
    if (!shape) {
      return { type: "object", properties: {}, required: [] };
    }

    const properties: Record<string, object> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodType = (value as any)._def?.typeName;
      
      switch (zodType) {
        case "ZodString":
          properties[key] = { type: "string" };
          break;
        case "ZodNumber":
          properties[key] = { type: "number" };
          break;
        case "ZodBoolean":
          properties[key] = { type: "boolean" };
          break;
        case "ZodArray":
          properties[key] = { type: "array", items: { type: "string" } };
          break;
        default:
          properties[key] = { type: "string" };
      }

      if (!(value as any).isOptional()) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }
}

export default OpenAIResponsesAPI;
