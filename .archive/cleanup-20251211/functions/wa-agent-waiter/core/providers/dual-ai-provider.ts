/**
 * Dual AI Provider with Automatic Failover (BaseAgent compatible)
 * Primary: OpenAI Responses API (Agents SDK compatible)
 * Fallback: Google Gemini SDK
 *
 * Implements IAIProvider interface for compatibility with BaseAgent.
 * Supports tool definitions and structured prompts while keeping a
 * backward-compatible `chat()` signature that returns plain text.
 */

import OpenAI from "npm:openai@^4.58.0";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.21.0";

import type { IAIProvider, Message, ChatConfig } from "../base-agent.ts";
import { logStructuredEvent } from "../../../_shared/observability.ts";
import { resolveOpenAiResponseText } from "../../../_shared/wa-webhook-shared/utils/openai_responses.ts";

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

interface DualChatConfig extends ChatConfig {
  tools?: ToolDefinition[];
  metadata?: Record<string, string>;
}

export class DualAIProvider implements IAIProvider {
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  // Default models tuned for WhatsApp chat; realtime model can be swapped via env
  private readonly PRIMARY_MODEL = Deno.env.get("OPENAI_RESPONSES_MODEL") || "gpt-4o-mini";
  private readonly FALLBACK_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash";
  private readonly REALTIME_MODEL = Deno.env.get("OPENAI_REALTIME_MODEL") || "gpt-4o-realtime-preview";

  constructor() {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }

    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
    }

    if (!this.openai && !this.gemini) {
      throw new Error("At least one AI provider API key must be configured (OPENAI_API_KEY or GEMINI_API_KEY)");
    }
  }

  /**
   * Chat with automatic failover.
   * Primary: OpenAI Responses API (tool + JSON friendly)
   * Fallback: Gemini SDK
   */
  async chat(messages: Message[], config?: DualChatConfig): Promise<string> {
    const startTime = Date.now();

    // Try OpenAI first
    if (this.openai) {
      try {
        const text = await this.chatWithOpenAI(messages, config);
        await logStructuredEvent("AI_PROVIDER_USED", {
          provider: "openai",
          model: config?.model || this.PRIMARY_MODEL,
          realtimeModel: this.REALTIME_MODEL,
          fallbackUsed: false,
          latencyMs: Date.now() - startTime,
        });
        return text;
      } catch (error) {
        await logStructuredEvent(
          "AI_PROVIDER_FAILURE",
          {
            provider: "openai",
            model: config?.model || this.PRIMARY_MODEL,
            error: error instanceof Error ? error.message : String(error),
            attemptingFailover: !!this.gemini,
          },
          "warn",
        );
      }
    }

    // Gemini fallback
    if (this.gemini) {
      try {
        const fallbackStart = Date.now();
        const text = await this.chatWithGemini(messages, config);
        await logStructuredEvent("AI_PROVIDER_USED", {
          provider: "gemini",
          model: config?.model || this.FALLBACK_MODEL,
          fallbackUsed: true,
          latencyMs: Date.now() - fallbackStart,
          totalLatencyMs: Date.now() - startTime,
        });
        return text;
      } catch (error) {
        await logStructuredEvent(
          "AI_PROVIDER_FAILURE",
          {
            provider: "gemini",
            model: config?.model || this.FALLBACK_MODEL,
            error: error instanceof Error ? error.message : String(error),
            totalFailure: true,
          },
          "error",
        );
        throw error;
      }
    }

    throw new Error("All AI providers failed");
  }

  /**
   * Stream implementation delegates to chat for now.
   */
  async *stream(messages: Message[], config?: DualChatConfig): AsyncIterable<string> {
    const result = await this.chat(messages, config);
    yield result;
  }

  private async chatWithOpenAI(messages: Message[], config?: DualChatConfig): Promise<string> {
    if (!this.openai) throw new Error("OpenAI client not initialized");

    const response = await (this.openai as any).responses.create({
      model: config?.model || this.PRIMARY_MODEL,
      input: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: config?.tools,
      temperature: config?.temperature ?? 0.7,
      max_output_tokens: config?.maxTokens ?? 1200,
      metadata: config?.metadata,
    });

    const text = resolveOpenAiResponseText(response) || response.output_text || "";
    if (!text.trim()) {
      throw new Error("Empty OpenAI response");
    }
    return text.trim();
  }

  private async chatWithGemini(messages: Message[], config?: DualChatConfig): Promise<string> {
    if (!this.gemini) throw new Error("Gemini client not initialized");
    const model = this.gemini.getGenerativeModel({ model: config?.model || this.FALLBACK_MODEL });

    const systemPrompt = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const history = messages
      .filter((m) => m.role !== "system")
      .slice(0, -1)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const tools = config?.tools
      ? [
          {
            functionDeclarations: config.tools.map((tool) => ({
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters,
            })),
          },
        ]
      : undefined;

    const chat = model.startChat({
      history: systemPrompt
        ? [
            {
              role: "user",
              parts: [{ text: `[SYSTEM]\n${systemPrompt}` }],
            },
            { role: "model", parts: [{ text: "Understood. I will follow the system instructions." }] },
            ...history,
          ]
        : history,
      tools,
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 1200,
      },
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const text = result.response.text();
    if (!text || !text.trim()) {
      throw new Error("Empty Gemini response");
    }
    return text.trim();
  }
}
