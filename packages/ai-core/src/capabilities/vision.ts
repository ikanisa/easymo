import { GeminiClient } from '../llm/gemini-client';

export interface VisionConfig {
  enabled: boolean;
  provider: 'gemini' | 'gpt4v';
  model?: string;
}

/**
 * Vision Capability
 * Handles image and video understanding
 */
export class VisionCapability {
  private gemini: GeminiClient;
  private config: VisionConfig;

  constructor(gemini: GeminiClient, config: VisionConfig) {
    this.gemini = gemini;
    this.config = config;
  }

  /**
   * Analyze image with text prompt
   */
  async analyzeImage(
    imageUrl: string,
    prompt: string
  ): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Vision capability not enabled');
    }

    if (this.config.provider === 'gemini') {
      return await this.analyzeWithGemini(imageUrl, prompt);
    }

    throw new Error(`Provider ${this.config.provider} not implemented`);
  }

  /**
   * Analyze multiple images
   */
  async analyzeImages(
    imageUrls: string[],
    prompt: string
  ): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Vision capability not enabled');
    }

    if (this.config.provider === 'gemini') {
      return await this.gemini.generateWithVision(
        prompt,
        imageUrls.map(url => this.urlToBase64(url))
      );
    }

    throw new Error(`Provider ${this.config.provider} not implemented`);
  }

  /**
   * Extract text from image (OCR)
   */
  async extractText(imageUrl: string): Promise<string> {
    return await this.analyzeImage(
      imageUrl,
      'Extract all text from this image. Return only the extracted text.'
    );
  }

  /**
   * Describe image
   */
  async describeImage(imageUrl: string): Promise<string> {
    return await this.analyzeImage(
      imageUrl,
      'Describe this image in detail.'
    );
  }

  /**
   * Answer question about image
   */
  async answerQuestion(
    imageUrl: string,
    question: string
  ): Promise<string> {
    return await this.analyzeImage(imageUrl, question);
  }

  /**
   * Analyze with Gemini Vision
   */
  private async analyzeWithGemini(
    imageUrl: string,
    prompt: string
  ): Promise<string> {
    const base64Image = await this.urlToBase64(imageUrl);
    return await this.gemini.generateWithVision(prompt, [base64Image], {
      model: this.config.model || 'gemini-2.5-pro'
    });
  }

  /**
   * Convert image URL to base64
   */
  private async urlToBase64(url: string): Promise<string> {
    // If already base64, return as is
    if (url.startsWith('data:')) {
      return url.split(',')[1];
    }

    // Fetch and convert to base64
    const axios = require('axios');
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
  }
}
