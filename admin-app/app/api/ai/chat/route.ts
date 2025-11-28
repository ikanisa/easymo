import { NextRequest, NextResponse } from "next/server";
import { routeChatRequest } from "@/lib/ai/router";

export const dynamic = "force-dynamic";

interface ChatRequestBody {
  messages: Array<{ role: string; content: string }>;
  provider?: "openai" | "gemini";
  maxCost?: "low" | "medium" | "high";
}

export async function POST(request: NextRequest) {
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
    const result = await routeChatRequest({
      messages: body.messages,
      preferredProvider: body.provider,
      maxCost: body.maxCost,
    });

    return NextResponse.json({
      id: crypto.randomUUID(),
      created: Math.floor(Date.now() / 1000),
      model: body.provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini",
      choices: result.choices,
      usage: result.usage,
    });
  } catch (error) {
    console.error("AI chat error:", error);
    const err = error as Error;
    
    return NextResponse.json(
      {
        error: "AI request failed",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
