/**
 * Search with Grounding API Route
 * Google Search-powered factual responses with citations
 */

import { NextRequest, NextResponse } from 'next/server';

import { generateFactualResponse, searchRecentInfo,searchWithGrounding } from '@/lib/ai/google/search-grounding';
import { logStructuredEvent } from '@/lib/monitoring/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SearchRequest {
  query: string;
  type?: 'search' | 'factual' | 'recent';
  context?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();

    if (!body.query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      );
    }

    await logStructuredEvent('AI_SEARCH_REQUEST', {
      type: body.type || 'search',
      queryLength: body.query.length,
    });

    let result;

    switch (body.type) {
      case 'factual':
        result = await generateFactualResponse(body.query, body.context);
        break;
      case 'recent':
        result = await searchRecentInfo(body.query);
        break;
      default:
        result = await searchWithGrounding(body.query);
    }

    await logStructuredEvent('AI_SEARCH_RESPONSE', {
      type: body.type || 'search',
      sourcesCount: result.sources?.length || 0,
    });

    return NextResponse.json({
      text: result.text,
      sources: result.sources,
      searchQueries: result.searchQueries,
      groundingMetadata: result.groundingMetadata,
    });
  } catch (error) {
    await logStructuredEvent('AI_SEARCH_ERROR', {
      error: (error as Error).message,
    });

    return NextResponse.json(
      {
        error: 'Search failed',
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
