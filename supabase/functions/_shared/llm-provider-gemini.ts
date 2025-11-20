/**
 * Google Gemini LLM Provider Implementation
 * 
 * Wraps Google Gemini API with the standard LLM Provider interface
 * Provides access to Gemini's Google-connected tools (Maps, Search, etc.)
 */

import { logStructuredEvent, logError, recordMetric } from "./observability.ts";
import type {
  LLMProvider,
  LLMCompletionOptions,
  LLMCompletionResponse,
  LLMToolDefinition,
  LLMToolCall,
} from "./llm-provider-interface.ts";

// Using Google's Generative AI SDK for Deno
import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from "npm:@google/generative-ai@^0.21.0";

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly supportedModels = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
    'gemini-pro-vision',
  ];

  private client: GoogleGenerativeAI;
  private correlationId?: string;

  constructor(apiKey?: string, correlationId?: string) {
    const key = apiKey || Deno.env.get("GEMINI_API_KEY");
    if (!key) {
      throw new Error("GEMINI_API_KEY is required");
    }
    this.client = new GoogleGenerativeAI(key);
    this.correlationId = correlationId;
  }

  async chat(options: LLMCompletionOptions): Promise<LLMCompletionResponse> {
    const startTime = Date.now();
    
    try {
      logStructuredEvent("GEMINI_CHAT_REQUEST", {
        model: options.model,
        messageCount: options.messages.length,
        hasTools: !!options.tools,
        correlationId: this.correlationId,
      });

      const model = this.client.getGenerativeModel({ 
        model: options.model || 'gemini-1.5-flash',
      });

      // Convert tools to Gemini format
      const tools = options.tools ? [{
        functionDeclarations: options.tools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: this.convertSchemaToGemini(tool.function.parameters),
        })),
      }] : undefined;

      // Build chat history
      const history = [];
      
      // Add system message as first user message if present
      if (options.system) {
        history.push({
          role: 'user',
          parts: [{ text: `[SYSTEM INSTRUCTIONS]\n${options.system}` }],
        });
        history.push({
          role: 'model',
          parts: [{ text: 'Understood. I will follow these instructions.' }],
        });
      }

      // Add conversation history
      for (let i = 0; i < options.messages.length - 1; i++) {
        const msg = options.messages[i];
        history.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }

      // Last message is the current user message
      const lastMessage = options.messages[options.messages.length - 1];

      // Start chat session
      const chat = model.startChat({
        history,
        tools,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens,
          topP: options.topP,
        },
      });

      // Send message
      const result = await chat.sendMessage(lastMessage.content);
      const response = result.response;

      // Extract function calls if present
      const toolCalls: LLMToolCall[] | undefined = response.functionCalls()?.map((fc, idx) => ({
        id: `call_${idx}_${Date.now()}`,
        type: 'function' as const,
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args),
        },
      }));

      const content = response.text();
      const duration = Date.now() - startTime;

      logStructuredEvent("GEMINI_CHAT_COMPLETE", {
        model: options.model,
        durationMs: duration,
        hasToolCalls: !!toolCalls,
        correlationId: this.correlationId,
      });

      recordMetric("llm.chat.request", 1, {
        provider: "gemini",
        model: options.model || 'gemini-1.5-flash',
        duration_ms: duration,
      });

      return {
        content,
        toolCalls,
        metadata: {
          model: options.model || 'gemini-1.5-flash',
          provider: 'gemini',
          finishReason: response.candidates?.[0]?.finishReason,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logError("gemini_chat_error", error, {
        model: options.model,
        durationMs: duration,
        correlationId: this.correlationId,
      });

      recordMetric("llm.chat.error", 1, {
        provider: "gemini",
        model: options.model || 'gemini-1.5-flash',
      });

      throw error;
    }
  }

  async embeddings(text: string, model = 'embedding-001'): Promise<number[]> {
    try {
      logStructuredEvent("GEMINI_EMBEDDINGS_REQUEST", {
        model,
        textLength: text.length,
        correlationId: this.correlationId,
      });

      const embeddingModel = this.client.getGenerativeModel({ model });
      const result = await embeddingModel.embedContent(text);

      recordMetric("llm.embeddings.request", 1, {
        provider: "gemini",
        model,
      });

      return result.embedding.values;

    } catch (error) {
      logError("gemini_embeddings_error", error, {
        model,
        correlationId: this.correlationId,
      });

      recordMetric("llm.embeddings.error", 1, {
        provider: "gemini",
        model,
      });

      throw error;
    }
  }

  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    try {
      logStructuredEvent("GEMINI_VISION_REQUEST", {
        imageUrl: imageUrl.substring(0, 100),
        promptLength: prompt.length,
        correlationId: this.correlationId,
      });

      // Fetch image as base64
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

      const model = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType: imageResponse.headers.get('content-type') || 'image/jpeg',
            data: base64Image,
          },
        },
      ]);

      recordMetric("llm.vision.request", 1, {
        provider: "gemini",
      });

      return result.response.text();

    } catch (error) {
      logError("gemini_vision_error", error, {
        correlationId: this.correlationId,
      });

      recordMetric("llm.vision.error", 1, {
        provider: "gemini",
      });

      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Make a minimal request to check API health
      const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      await model.generateContent("test");
      return true;
    } catch (error) {
      logError("gemini_health_check_failed", error, {
        correlationId: this.correlationId,
      });
      return false;
    }
  }

  /**
   * Convert OpenAI-style JSON schema to Gemini format
   */
  private convertSchemaToGemini(schema: Record<string, unknown>): any {
    const converted: any = {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {},
      required: schema.required || [],
    };

    if (schema.properties && typeof schema.properties === 'object') {
      for (const [key, value] of Object.entries(schema.properties)) {
        const prop = value as any;
        converted.properties[key] = {
          type: this.mapTypeToGemini(prop.type),
          description: prop.description,
        };

        if (prop.enum) {
          converted.properties[key].enum = prop.enum;
        }
      }
    }

    return converted;
  }

  private mapTypeToGemini(type: string): FunctionDeclarationSchemaType {
    const typeMap: Record<string, FunctionDeclarationSchemaType> = {
      'string': FunctionDeclarationSchemaType.STRING,
      'number': FunctionDeclarationSchemaType.NUMBER,
      'integer': FunctionDeclarationSchemaType.INTEGER,
      'boolean': FunctionDeclarationSchemaType.BOOLEAN,
      'array': FunctionDeclarationSchemaType.ARRAY,
      'object': FunctionDeclarationSchemaType.OBJECT,
    };
    
    return typeMap[type] || FunctionDeclarationSchemaType.STRING;
  }
}
