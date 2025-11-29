/**
 * Google Imagen - AI Image Generation
 * Generate images from text descriptions using Imagen 3
 */

import { getGeminiClient } from '../providers/gemini-client';

export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  numberOfImages?: number;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  safetyFilterLevel?: 'block_none' | 'block_some' | 'block_most';
}

export interface ImageGenerationResult {
  images: Array<{
    base64Data: string;
    mimeType: string;
  }>;
  prompt: string;
  safetyRatings?: any[];
}

/**
 * Generate images using Imagen (via Gemini API)
 * Note: Full Imagen support requires Vertex AI. This uses Gemini's image generation.
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const client = getGeminiClient();
  
  // Use Gemini's experimental image generation
  // In production, use Vertex AI Imagen API for better quality
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  });

  let fullPrompt = `Generate an image: ${options.prompt}`;
  
  if (options.negativePrompt) {
    fullPrompt += `\nAvoid: ${options.negativePrompt}`;
  }

  if (options.aspectRatio) {
    fullPrompt += `\nAspect ratio: ${options.aspectRatio}`;
  }

  fullPrompt += '\n\nReturn a high-quality, detailed image.';

  const result = await model.generateContent(fullPrompt);
  const response = result.response;

  // Extract image data from response
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  
  const images: Array<{ base64Data: string; mimeType: string }> = [];
  
  for (const part of parts) {
    if ((part as any).inlineData?.mimeType?.startsWith('image/')) {
      images.push({
        base64Data: (part as any).inlineData.data,
        mimeType: (part as any).inlineData.mimeType,
      });
    }
  }

  return {
    images,
    prompt: options.prompt,
    safetyRatings: candidate?.safetyRatings,
  };
}

/**
 * Generate product images for marketplace
 */
export async function generateProductImage(params: {
  productName: string;
  productCategory: string;
  style?: 'realistic' | 'minimalist' | 'artistic' | 'professional';
  backgroundColor?: string;
}): Promise<ImageGenerationResult> {
  const styleDescriptions = {
    realistic: 'photorealistic, high detail, professional product photography',
    minimalist: 'clean, simple, minimalist style, white background',
    artistic: 'artistic, creative, vibrant colors',
    professional: 'professional studio lighting, commercial photography',
  };

  const prompt = `A ${styleDescriptions[params.style || 'professional']} image of ${params.productName}, ${params.productCategory} product${params.backgroundColor ? `, ${params.backgroundColor} background` : ''}. High quality, commercial use.`;

  return generateImage({
    prompt,
    numberOfImages: 1,
    aspectRatio: '1:1',
  });
}

/**
 * Generate marketing banners
 */
export async function generateMarketingBanner(params: {
  title: string;
  description: string;
  theme: 'mobility' | 'marketplace' | 'delivery' | 'promotion';
  aspectRatio?: '16:9' | '4:3';
}): Promise<ImageGenerationResult> {
  const themeStyles = {
    mobility: 'modern, urban, transportation theme, blue and green colors',
    marketplace: 'vibrant, shopping theme, colorful, engaging',
    delivery: 'fast, efficient, delivery theme, orange and blue',
    promotion: 'eye-catching, promotional, bold colors, special offer style',
  };

  const prompt = `Marketing banner: "${params.title}" - ${params.description}. ${themeStyles[params.theme]}. Professional design, clear typography space.`;

  return generateImage({
    prompt,
    numberOfImages: 1,
    aspectRatio: params.aspectRatio || '16:9',
  });
}

/**
 * Edit/enhance existing images (requires image input)
 */
export async function enhanceImage(params: {
  imageBase64: string;
  imageMimeType: string;
  enhancementPrompt: string;
}): Promise<ImageGenerationResult> {
  const client = getGeminiClient();
  
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  });

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: params.imageMimeType,
            data: params.imageBase64,
          },
        },
        { text: params.enhancementPrompt },
      ],
    }],
  });

  const response = result.response;
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  
  const images: Array<{ base64Data: string; mimeType: string }> = [];
  
  for (const part of parts) {
    if ((part as any).inlineData?.mimeType?.startsWith('image/')) {
      images.push({
        base64Data: (part as any).inlineData.data,
        mimeType: (part as any).inlineData.mimeType,
      });
    }
  }

  return {
    images,
    prompt: params.enhancementPrompt,
  };
}

/**
 * Generate variations of an image
 */
export async function generateImageVariations(params: {
  originalImageBase64: string;
  originalImageMimeType: string;
  variationStyle: string;
  numberOfVariations?: number;
}): Promise<ImageGenerationResult[]> {
  const results: ImageGenerationResult[] = [];
  const count = params.numberOfVariations || 3;

  for (let i = 0; i < count; i++) {
    const prompt = `Create a variation of this image with ${params.variationStyle} style. Make it unique but maintain the core concept.`;
    const result = await enhanceImage({
      imageBase64: params.originalImageBase64,
      imageMimeType: params.originalImageMimeType,
      enhancementPrompt: prompt,
    });
    results.push(result);
  }

  return results;
}

/**
 * Image-to-text description (useful for alt text, SEO)
 */
export async function describeImage(params: {
  imageBase64: string;
  imageMimeType: string;
  detailLevel?: 'brief' | 'detailed' | 'technical';
}): Promise<string> {
  const client = getGeminiClient();
  
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  });

  const prompts = {
    brief: 'Describe this image in 1-2 sentences.',
    detailed: 'Provide a detailed description of this image, including objects, colors, composition, and mood.',
    technical: 'Provide a technical description of this image suitable for product listings, including specific details, measurements if visible, and key features.',
  };

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: params.imageMimeType,
            data: params.imageBase64,
          },
        },
        { text: prompts[params.detailLevel || 'detailed'] },
      ],
    }],
  });

  return result.response.text();
}
