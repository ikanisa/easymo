import { getOpenAIClient } from "../ai/providers/openai-client";
import { getGeminiClient } from "../ai/providers/gemini-client";

export interface ImageAnalysisResult {
  description: string;
  objects: string[];
  text?: string;
  metadata?: Record<string, any>;
}

export class MultiModalProcessor {
  private openai = getOpenAIClient();
  private gemini = getGeminiClient();

  // Analyze image with GPT-4 Vision
  async analyzeImage(
    imageUrl: string,
    prompt?: string
  ): Promise<ImageAnalysisResult> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt || "Describe this image in detail. What objects, people, text, or activities do you see?",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const description = response.choices[0].message.content || "";

    return {
      description,
      objects: this.extractObjects(description),
      metadata: {
        model: "gpt-4o",
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Analyze image with Gemini
  async analyzeImageGemini(
    imageBase64: string,
    prompt?: string
  ): Promise<ImageAnalysisResult> {
    const model = this.gemini.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const result = await model.generateContent([
      prompt || "Describe this image in detail.",
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64,
        },
      },
    ]);

    const description = result.response.text();

    return {
      description,
      objects: this.extractObjects(description),
      metadata: {
        model: "gemini-2.0-flash-exp",
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Extract text from image (OCR)
  async extractTextFromImage(imageUrl: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this image. Return only the text content, no descriptions.",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    });

    return response.choices[0].message.content || "";
  }

  // Generate image with DALL-E
  async generateImage(
    prompt: string,
    size: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024"
  ): Promise<{ url: string; revisedPrompt?: string }> {
    const response = await this.openai.images.generate({
      model: "dall-e-3",
      prompt,
      size,
      quality: "standard",
      n: 1,
    });

    return {
      url: response.data[0].url || "",
      revisedPrompt: response.data[0].revised_prompt,
    };
  }

  // Process PDF (extract text)
  async processPDF(pdfUrl: string): Promise<string> {
    // This would require pdf-parse or similar library
    // Placeholder for now
    return "PDF processing would be implemented here";
  }

  // Transcribe audio
  async transcribeAudio(audioFile: File): Promise<string> {
    const response = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    return response.text;
  }

  // Generate speech from text
  async textToSpeech(
    text: string,
    voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy"
  ): Promise<ArrayBuffer> {
    const response = await this.openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
    });

    return await response.arrayBuffer();
  }

  // Compare images
  async compareImages(
    imageUrl1: string,
    imageUrl2: string
  ): Promise<{ similarity: string; differences: string }> {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Compare these two images. Describe their similarities and differences.",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl1 },
            },
            {
              type: "image_url",
              image_url: { url: imageUrl2 },
            },
          ],
        },
      ],
    });

    const result = response.choices[0].message.content || "";
    const parts = result.split(/differences?:/i);

    return {
      similarity: parts[0] || result,
      differences: parts[1] || "",
    };
  }

  // Helper to extract objects from description
  private extractObjects(description: string): string[] {
    // Simple extraction - in production, use NLP
    const keywords = description
      .toLowerCase()
      .match(/\b(person|car|building|tree|sky|road|sign|vehicle|driver|passenger)\w*/g);

    return [...new Set(keywords || [])];
  }
}

export const multiModalProcessor = new MultiModalProcessor();

// Utility functions
export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
}

export function isAudioUrl(url: string): boolean {
  return /\.(mp3|wav|ogg|m4a|flac)$/i.test(url);
}

export function isPdfUrl(url: string): boolean {
  return /\.pdf$/i.test(url);
}
