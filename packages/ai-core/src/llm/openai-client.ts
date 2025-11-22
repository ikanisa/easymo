import OpenAI from 'openai';

import { ModelConfig } from '../base/types';

export class OpenAIClient {
  private openai: OpenAI;
  private defaultModel: string = 'gpt-4-turbo'; // Will use gpt-5 when available

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Get OpenAI client instance
   */
  getClient(): OpenAI {
    return this.openai;
  }

  /**
   * Resolve model name (handle GPT-5 availability)
   */
  private resolveModelName(model: string): string {
    const modelMap: Record<string, string> = {
      'gpt-5': 'gpt-5', // Will use when available, fallback handled in catch
      'gpt-4-turbo': 'gpt-4-turbo-preview',
      'gpt-4': 'gpt-4-0125-preview'
    };

    return modelMap[model] || model;
  }

  /**
   * Create a chat completion
   */
  async createChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools?: OpenAI.Chat.ChatCompletionTool[],
    config?: Partial<ModelConfig>
  ): Promise<OpenAI.Chat.ChatCompletion> {
    const modelName = this.resolveModelName(config?.model || this.defaultModel);

    try {
      return await this.openai.chat.completions.create({
        model: modelName,
        messages,
        tools,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.maxTokens ?? 4096,
        top_p: config?.topP ?? 1.0,
      });
    } catch (error: any) {
      // Fallback to GPT-4 Turbo if GPT-5 not available
      if (error?.error?.code === 'model_not_found' && modelName === 'gpt-5') {
        console.warn('GPT-5 not available, falling back to GPT-4 Turbo');
        return await this.openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages,
          tools,
          temperature: config?.temperature ?? 0.7,
          max_tokens: config?.maxTokens ?? 4096,
        });
      }
      throw error;
    }
  }

  /**
   * Create a streaming chat completion
   */
  async createStreamingCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools?: OpenAI.Chat.ChatCompletionTool[],
    config?: Partial<ModelConfig>
  ): Promise<AsyncIterable<OpenAI.Chat.ChatCompletionChunk>> {
    const modelName = this.resolveModelName(config?.model || this.defaultModel);

    return await this.openai.chat.completions.create({
      model: modelName,
      messages,
      tools,
      temperature: config?.temperature ?? 0.7,
      max_tokens: config?.maxTokens ?? 4096,
      stream: true,
    }) as any;
  }

  /**
   * Generate with vision (GPT-4V)
   */
  async generateWithVision(
    prompt: string,
    imageUrls: string[],
    config?: Partial<ModelConfig>
  ): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imageUrls.map(url => ({
            type: 'image_url' as const,
            image_url: { url }
          }))
        ]
      }
    ];

    const response = await this.createChatCompletion(messages, undefined, {
      ...config,
      model: 'gpt-4-vision-preview'
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Check if a model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      await this.openai.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
