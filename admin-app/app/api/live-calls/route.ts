import { NextResponse } from "next/server";
import { z } from "zod";
import { liveCallSchema } from "@/lib/schemas";
import { mockLiveCalls } from "@/lib/mock-data";
import { getVoiceBridgeApiUrl, shouldUseMocks } from "@/lib/runtime-config";

const liveCallsResponseSchema = z.object({
  calls: z.array(liveCallSchema),
  generatedAt: z.string().datetime().optional(),
});

function fallbackResponse() {
  return NextResponse.json({
    calls: mockLiveCalls,
    generatedAt: new Date().toISOString(),
    integration: {
      status: "mock",
      message: "Using live call fixtures",
    },
  });
}

export async function GET() {
  if (shouldUseMocks()) {
    return fallbackResponse();
  }

  const voiceUrl = getVoiceBridgeApiUrl();
  if (!voiceUrl) {
    return fallbackResponse();
  }

  try {
    const response = await fetch(`${voiceUrl.replace(/\/$/, "")}/analytics/live-calls`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Voice bridge responded with ${response.status}`);
    }
    const parsed = liveCallsResponseSchema.parse(await response.json());
    return NextResponse.json({
      ...parsed,
      integration: { status: "ok" },
    });
  } catch (error) {
    console.error("live-calls.fetch_failed", error);
    return fallbackResponse();
  }
}
