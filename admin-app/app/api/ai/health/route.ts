import { NextResponse } from "next/server";

import { getGeminiClient } from "@/lib/ai/providers/gemini-client";
import { getOpenAIClient } from "@/lib/ai/providers/openai-client";

export const dynamic = "force-dynamic";

interface HealthStatus {
  openai: "healthy" | "unhealthy" | "not_configured";
  gemini: "healthy" | "unhealthy" | "not_configured";
  timestamp: string;
}

export async function GET() {
  const health: HealthStatus = {
    openai: "not_configured",
    gemini: "not_configured",
    timestamp: new Date().toISOString(),
  };

  // Test OpenAI
  try {
    const client = getOpenAIClient();
    await client.models.list({ limit: 1 });
    health.openai = "healthy";
  } catch (error) {
    const err = error as Error;
    if (err.message.includes("not configured")) {
      health.openai = "not_configured";
    } else {
      health.openai = "unhealthy";
      console.error("OpenAI health check failed:", err);
    }
  }

  // Test Gemini
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    await model.generateContent("test");
    health.gemini = "healthy";
  } catch (error) {
    const err = error as Error;
    if (err.message.includes("not configured")) {
      health.gemini = "not_configured";
    } else {
      health.gemini = "unhealthy";
      console.error("Gemini health check failed:", err);
    }
  }

  const status =
    health.openai === "healthy" || health.gemini === "healthy"
      ? 200
      : health.openai === "not_configured" && health.gemini === "not_configured"
        ? 503
        : 503;

  return NextResponse.json(health, { status });
}
