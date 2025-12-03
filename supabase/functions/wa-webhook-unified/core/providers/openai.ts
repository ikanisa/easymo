/**
 * OpenAI AI Provider
 * Secondary AI provider using OpenAI GPT-5
 * 
 * Part of Unified AI Agent Architecture
 */

import type { Message, ChatConfig, AIProvider } from "./index.ts";

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private defaultModel = "gpt-5";
  private apiEndpoint = "https://api.openai.com/v1/chat/completions";

  constructor() {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable not set");
    }
    this.apiKey = apiKey;
  }

  get name(): string {
    return "openai";
  }

  get model(): string {
    return this.defaultModel;
  }

  /**
   * Chat completion - main method for agent interactions
   */
  async chat(messages: Message[], config?: ChatConfig): Promise<string> {
    const model = config?.model ?? this.defaultModel;

    const requestBody = {
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: config?.temperature ?? 0.7,
      max_tokens: config?.maxTokens ?? 1000,
    };

    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      
      // Extract text from response
      const text = data.choices?.[0]?.message?.content;
      
      if (!text) {
        throw new Error("No text in OpenAI response");
      }

      return text;
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw error;
    }
  }

  /**
   * Streaming chat (optional - for future use)
   */
  async *stream(messages: Message[], config?: ChatConfig): AsyncIterable<string> {
    const model = config?.model ?? this.defaultModel;

    const requestBody = {
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: config?.temperature ?? 0.7,
      max_tokens: config?.maxTokens ?? 1000,
      stream: true,
    };

    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI streaming error: ${response.status} - ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() && line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            
            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.delta?.content;
              if (text) {
                yield text;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error("OpenAI streaming error:", error);
      throw error;
    }
  }
}
