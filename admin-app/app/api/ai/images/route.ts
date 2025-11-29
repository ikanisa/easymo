/**
 * Image Generation API Route
 * Imagen-powered image creation and manipulation
 */

import { NextRequest, NextResponse } from 'next/server';

import { describeImage,generateImage, generateMarketingBanner, generateProductImage } from '@/lib/ai/google/imagen';
import { logStructuredEvent } from '@/lib/monitoring/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ImageRequest {
  action: 'generate' | 'product' | 'banner' | 'describe';
  prompt?: string;
  productName?: string;
  productCategory?: string;
  title?: string;
  description?: string;
  theme?: 'mobility' | 'marketplace' | 'delivery' | 'promotion';
  imageData?: string; // base64 for describe
  imageMimeType?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
}

export async function POST(request: NextRequest) {
  try {
    const body: ImageRequest = await request.json();

    await logStructuredEvent('AI_IMAGE_REQUEST', {
      action: body.action,
    });

    let result;

    switch (body.action) {
      case 'generate':
        if (!body.prompt) {
          return NextResponse.json(
            { error: 'prompt required for generate' },
            { status: 400 }
          );
        }
        result = await generateImage({
          prompt: body.prompt,
          aspectRatio: body.aspectRatio,
        });
        break;

      case 'product':
        if (!body.productName || !body.productCategory) {
          return NextResponse.json(
            { error: 'productName and productCategory required' },
            { status: 400 }
          );
        }
        result = await generateProductImage({
          productName: body.productName,
          productCategory: body.productCategory,
        });
        break;

      case 'banner':
        if (!body.title || !body.description || !body.theme) {
          return NextResponse.json(
            { error: 'title, description, and theme required' },
            { status: 400 }
          );
        }
        result = await generateMarketingBanner({
          title: body.title,
          description: body.description,
          theme: body.theme,
          aspectRatio: body.aspectRatio === '16:9' || body.aspectRatio === '4:3' ? body.aspectRatio : '16:9',
        });
        break;

      case 'describe':
        if (!body.imageData || !body.imageMimeType) {
          return NextResponse.json(
            { error: 'imageData and imageMimeType required' },
            { status: 400 }
          );
        }
        const description = await describeImage({
          imageBase64: body.imageData,
          imageMimeType: body.imageMimeType,
          detailLevel: 'detailed',
        });
        return NextResponse.json({ description });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}` },
          { status: 400 }
        );
    }

    await logStructuredEvent('AI_IMAGE_RESPONSE', {
      action: body.action,
      imagesGenerated: result.images?.length || 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    await logStructuredEvent('AI_IMAGE_ERROR', {
      error: (error as Error).message,
    });

    return NextResponse.json(
      {
        error: 'Image generation failed',
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
