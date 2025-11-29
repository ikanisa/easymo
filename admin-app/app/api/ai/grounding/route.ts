import { NextRequest, NextResponse } from "next/server";

import {
  compareSourcesOnTopic,
  formatGroundedResponseAsMarkdown,
  generateFactualResponse,
  searchRecentInfo,
  searchWithGrounding,
  summarizeWithSources,
} from "@/lib/ai/google/search-grounding";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, action, context, focusAreas } = body;

    if (!query) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "search":
        result = await searchWithGrounding(query);
        break;

      case "factual":
        result = await generateFactualResponse(query, context);
        break;

      case "recent":
        result = await searchRecentInfo(query);
        break;

      case "compare":
        result = await compareSourcesOnTopic(query);
        break;

      case "summarize":
        result = await summarizeWithSources(query, focusAreas);
        break;

      default:
        // Default to basic search with grounding
        result = await searchWithGrounding(query);
    }

    // Format as markdown if requested
    const format = request.nextUrl.searchParams.get("format");
    const markdown = format === "markdown" ? formatGroundedResponseAsMarkdown(result) : undefined;

    return NextResponse.json({
      success: true,
      query,
      action: action || "search",
      response: result.text,
      sources: result.sources,
      searchQueries: result.searchQueries,
      groundingMetadata: result.groundingMetadata,
      markdown,
    });
  } catch (error) {
    console.error("Grounding API error:", error);
    const err = error as Error;

    if (err.message.includes("not configured")) {
      return NextResponse.json(
        {
          error: "Google AI API key not configured",
          details: "Please set GOOGLE_AI_API_KEY environment variable",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Grounding request failed",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
