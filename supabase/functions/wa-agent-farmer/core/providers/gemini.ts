/**
 * Gemini AI Provider
 * Unified AI provider using Google Gemini
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 */

import type { Message, ChatConfig, IAIProvider } from '../base-agent.ts';

export class GeminiProvider implements IAIProvider {
  private apiKey: string;
  private defaultModel = 'gemini-3';  // Per README.md: Mandatory Gemini-3 for AI features
  private apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set');
    }
    this.apiKey = apiKey;
  }

  /**
   * Chat completion - main method for agent interactions
   */
  async chat(messages: Message[], config?: ChatConfig): Promise<string> {
    const model = config?.model ?? this.defaultModel;
    const url = `${this.apiEndpoint}/${model}:generateContent?key=${this.apiKey}`;

    // Convert messages to Gemini format
    const contents = this.convertToGeminiFormat(messages);

    const requestBody = {
      contents,
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 2000,
        topP: 0.95,
        topK: 40,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      
      // Extract text from response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('No text in Gemini response');
      }

      return text;
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  /**
   * Streaming chat (optional - for future use)
   */
  async *stream(messages: Message[], config?: ChatConfig): AsyncIterable<string> {
    const model = config?.model ?? this.defaultModel;
    const url = `${this.apiEndpoint}/${model}:streamGenerateContent?key=${this.apiKey}`;

    const contents = this.convertToGeminiFormat(messages);

    const requestBody = {
      contents,
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 2000,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini streaming error: ${response.status} - ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
      console.error('Gemini streaming error:', error);
      throw error;
    }
  }

  /**
   * Convert standard message format to Gemini format
   */
  private convertToGeminiFormat(messages: Message[]): any[] {
    const contents: any[] = [];
    let systemPrompt = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Gemini doesn't have a system role, prepend to first user message
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

        // Clear system prompt after first use
        if (systemPrompt) systemPrompt = '';
      }
    }

    return contents;
  }
}
