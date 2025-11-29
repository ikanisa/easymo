import { NextRequest, NextResponse } from "next/server";

import { AgentExecutor } from "@/lib/ai/agent-executor";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, systemPrompt, tools, model, maxIterations } = body;

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const agent = new AgentExecutor({
      model: model || "gpt-4o-mini",
      systemPrompt: systemPrompt || "You are a helpful AI assistant for EasyMO.",
      maxIterations: maxIterations || 5,
      tools: tools || ["google_maps", "search_grounding", "database_query"],
    });

    const result = await agent.execute(message);

    return NextResponse.json({
      success: true,
      response: result.response,
      toolCalls: result.toolCalls,
      iterations: result.iterations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Agent execution error:", error);
    const err = error as Error;

    return NextResponse.json(
      {
        error: "Agent execution failed",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
