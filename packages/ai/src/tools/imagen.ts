/**
 * Google Imagen Image Generation Tool
 *
 * Provides image generation capabilities using Google's Imagen 3.0 model.
 *
 * @packageDocumentation
 */

import { childLogger } from '@easymo/commons';
import { z } from 'zod';

const log = childLogger({ service: 'imagen-tool' });

// ============================================================================
// TYPES
// ============================================================================

/**
 * Image generation result
 */
export interface ImageGenerationResult {
  images: Array<{
    base64: string;
    mimeType: string;
  }>;
  prompt: string;
  model: string;
  durationMs: number;
}

/**
 * Aspect ratio options
 */
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

// ============================================================================
// SCHEMAS
// ============================================================================

export const ImagenInputSchema = z.object({
  prompt: z.string().describe('Text description of the image to generate'),
  numberOfImages: z.number().min(1).max(4).optional().default(1),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional().default('1:1'),
  negativePrompt: z.string().optional().describe('What to avoid in the image'),
  personGeneration: z.enum(['allow_adult', 'dont_allow']).optional().default('dont_allow'),
  safetyFilterLevel: z.enum(['block_most', 'block_some', 'block_few']).optional().default('block_some'),
});

export type ImagenInput = z.infer<typeof ImagenInputSchema>;

// ============================================================================
// IMAGEN TOOL
// ============================================================================

/**
 * Imagen tool definition for function calling
 */
export const imagenTool = {
  name: 'imagen_generate',
  description: 'Generate images from text descriptions using Google Imagen 3.0. Useful for creating product images, illustrations, and visual content.',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Detailed text description of the image to generate',
      },
      numberOfImages: {
        type: 'number',
        description: 'Number of images to generate (1-4)',
        minimum: 1,
        maximum: 4,
      },
      aspectRatio: {
        type: 'string',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        description: 'Aspect ratio for the generated image',
      },
      negativePrompt: {
        type: 'string',
        description: 'What to avoid in the generated image',
      },
    },
    required: ['prompt'],
  },
  handler: generateImage,
};

/**
 * Generated image from API
 */
interface GeneratedImage {
  image?: {
    imageBytes?: string;
  };
}

/**
 * Generate images using Google Imagen
 *
 * Note: Requires GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable.
 * Uses the @google/genai SDK for Imagen 3.0 access.
 */
export async function generateImage(
  input: ImagenInput,
  context?: { geminiApiKey?: string },
): Promise<ImageGenerationResult> {
  const startTime = Date.now();
  const apiKey = context?.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_AI_API_KEY not configured');
  }

  try {
    // Import GoogleGenAI dynamically
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    log.info(
      {
        event: 'IMAGEN_GENERATE_START',
        promptLength: input.prompt.length,
        numberOfImages: input.numberOfImages || 1,
        aspectRatio: input.aspectRatio || '1:1',
      },
      'Starting image generation',
    );

    // Use any for the response as the SDK types are not stable
    const response = await (ai.models as unknown as {
      generateImages: (params: {
        model: string;
        prompt: string;
        config: Record<string, unknown>;
      }) => Promise<{ generatedImages?: GeneratedImage[] }>;
    }).generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: input.prompt,
      config: {
        numberOfImages: input.numberOfImages || 1,
        aspectRatio: input.aspectRatio || '1:1',
        negativePrompt: input.negativePrompt,
        personGeneration: input.personGeneration || 'dont_allow',
        safetyFilterLevel: input.safetyFilterLevel || 'block_some',
        outputMimeType: 'image/png',
      },
    });

    const durationMs = Date.now() - startTime;

    const images = (response.generatedImages || []).map((img: GeneratedImage) => ({
      base64: img.image?.imageBytes || '',
      mimeType: 'image/png',
    })).filter(img => img.base64);

    log.info(
      {
        event: 'IMAGEN_GENERATE_SUCCESS',
        imagesGenerated: images.length,
        durationMs,
      },
      'Image generation completed',
    );

    return {
      images,
      prompt: input.prompt,
      model: 'imagen-3.0-generate-002',
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    log.error(
      {
        event: 'IMAGEN_GENERATE_ERROR',
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      },
      'Image generation failed',
    );

    throw error;
  }
}

/**
 * Generate a single image and return base64
 *
 * Convenience function for simple use cases.
 */
export async function generateSingleImage(
  prompt: string,
  aspectRatio: AspectRatio = '1:1',
  context?: { geminiApiKey?: string },
): Promise<string> {
  const result = await generateImage(
    {
      prompt,
      numberOfImages: 1,
      aspectRatio,
    },
    context,
  );

  if (result.images.length === 0) {
    throw new Error('No image generated');
  }

  return result.images[0].base64;
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export const IMAGE_TOOLS = {
  imagen_generate: imagenTool,
};

/**
 * Get image tool schemas for function calling
 */
export function getImageToolSchemas(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return Object.values(IMAGE_TOOLS).map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
