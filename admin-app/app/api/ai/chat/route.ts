import { NextRequest, NextResponse } from "next/server";
import { routeChatRequest } from "@/lib/ai/router";
import { getRateLimitKey, checkRateLimit, apiRateLimiter } from "@/lib/middleware/rate-limit";
import { trackApiCall } from "@/lib/monitoring/usage-tracker";
import { trackPerformance } from "@/lib/monitoring/performance";

export const dynamic = "force-dynamic";

interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>;
  provider?: "openai" | "gemini";
  maxCost?: "low" | "medium" | "high";
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Rate limiting
  const rateLimitKey = getRateLimitKey(request);
  const rateLimit = checkRateLimit(rateLimitKey, apiRateLimiter);
  
  if (!rateLimit.allowed) {
    trackPerformance("/api/ai/chat", "POST", 429, startTime);
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimit.headers }
    );
  }

  try {
    const body: ChatRequestBody = await request.json();

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    if (body.messages.length === 0) {
      return NextResponse.json(
        { error: "messages array cannot be empty" },
        { status: 400 }
      );
    }

    // Route the request through multi-provider system
    const result = await trackApiCall(
      "/api/ai/chat",
      body.provider || "openai",
      body.provider === "gemini" ? "gemini-2.0-flash-exp" : "gpt-4o-mini",
      () => routeChatRequest({
        messages: body.messages,
        preferredProvider: body.provider,
        maxCost: body.maxCost,
      })
    );

    trackPerformance("/api/ai/chat", "POST", 200, startTime, body.provider);

    return NextResponse.json(
      {
        id: crypto.randomUUID(),
        created: Math.floor(Date.now() / 1000),
        model: body.provider === "gemini" ? "gemini-2.0-flash-exp" : "gpt-4o-mini",
        choices: result.choices,
        usage: result.usage,
      },
      { headers: rateLimit.headers }
    );
  } catch (error) {
    trackPerformance("/api/ai/chat", "POST", 500, startTime);
    console.error("AI chat error:", error);
    const err = error as Error;
    
    return NextResponse.json(
      {
        error: "AI request failed",
        details: err.message,
      },
      { status: 500, headers: rateLimit.headers }
    );
  }
}
