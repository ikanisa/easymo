import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ModelConfig, AgentContext } from '../base/types';

export class GeminiClient {
  private gemini: GoogleGenerativeAI;
  private defaultModel: string = 'gemini-2.5-pro-latest'; // Will fallback to gemini-1.5-pro if unavailable

  constructor(apiKey: string) {
    this.gemini = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Get a Gemini model instance
   */
  getModel(config?: Partial<ModelConfig>): GenerativeModel {
    const modelName = config?.model || this.defaultModel;
    
    return this.gemini.getGenerativeModel({
      model: this.resolveModelName(modelName),
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 8192,
        topP: config?.topP ?? 0.95,
      }
    });
  }

  /**
   * Resolve model name (handle fallbacks)
   */
  private resolveModelName(model: string): string {
    // Map our model names to actual Gemini model names
    const modelMap: Record<string, string> = {
      'gemini-2.5-pro': 'gemini-2.5-pro-latest',
      'gemini-3.0': 'gemini-3.0-latest', // Future model
      'gemini-2.0-flash': 'gemini-2.0-flash-exp',
      'gemini-1.5-pro': 'gemini-1.5-pro-latest'
    };

    return modelMap[model] || model;
  }

  /**
   * Start a chat session with tools
   */
  async startChat(
    model: GenerativeModel,
    tools: any[],
    history?: any[]
  ) {
    const geminiTools = tools.length > 0 ? [{
      functionDeclarations: tools
    }] : undefined;

    return model.startChat({
      history: history || [],
      tools: geminiTools as any
    });
  }

  /**
   * Generate content with vision (multimodal)
   */
  async generateWithVision(
    prompt: string,
    images: string[], // Base64 encoded images
    config?: Partial<ModelConfig>
  ): Promise<string> {
    const model = this.getModel(config);
    
    const parts = [
      { text: prompt },
      ...images.map(img => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: img
        }
      }))
    ];

    const result = await model.generateContent(parts as any);
    return result.response.text();
  }

  /**
   * Check if a model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const model = this.gemini.getGenerativeModel({ model: modelName });
      await model.generateContent('test');
      return true;
    } catch (error) {
      return false;
    }
  }
}
