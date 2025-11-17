export const dynamic = 'force-dynamic';
import { z } from "zod";
import { liveCallSchema } from "@/lib/schemas";
import { getVoiceBridgeApiUrl, shouldUseMocks } from "@/lib/runtime-config";
import { jsonError, jsonOk } from "@/lib/api/http";

const liveCallsResponseSchema = z.object({
  calls: z.array(liveCallSchema),
  generatedAt: z.string().datetime().optional(),
});

export async function GET() {
  if (shouldUseMocks()) {
    return jsonError({ error: 'unavailable', message: 'Voice bridge not configured in this environment.' }, 503);
  }

  const voiceUrl = getVoiceBridgeApiUrl();
  if (!voiceUrl) {
    return jsonError({ error: 'unavailable', message: 'VOICE_BRIDGE_API_URL is not set.' }, 503);
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
    return jsonOk({ ...parsed, integration: { status: 'ok' as const } });
  } catch (error) {
    console.error("live-calls.fetch_failed", error);
    return jsonError({ error: 'upstream_failed', message: 'Failed to fetch live calls.' }, 502);
  }
}

export const runtime = "nodejs";
