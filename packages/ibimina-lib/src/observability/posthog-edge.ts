import { parseSampleRate, resolveEnvironment } from "./env";
import { scrubPII } from "./pii";
import { shouldSampleEvent } from "./sampling";

const environment = resolveEnvironment();
const defaultEdgeSampleRate = parseSampleRate(
  process.env.POSTHOG_EDGE_SAMPLE_RATE ?? process.env.POSTHOG_CAPTURE_SAMPLE_RATE,
  environment === "production" ? 0.35 : 1
);

export type CaptureEdgeEventOptions = {
  readonly sampleRate?: number;
};

export async function captureEdgeEvent(
  event: string,
  properties: Record<string, unknown> = {},
  distinctId = "edge",
  options: CaptureEdgeEventOptions = {}
): Promise<void> {
  const apiKey = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    return;
  }

  const sampleRate = options.sampleRate ?? defaultEdgeSampleRate;
  if (!shouldSampleEvent({ event, distinctId, sampleRate })) {
    return;
  }

  const host =
    process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
  const endpoint = `${host.replace(/\/$/, "")}/capture/`;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: {
          ...scrubPII(properties),
          app: properties.app ?? "client",
        },
      }),
    });
  } catch (error) {
    console.warn("[posthog-edge] capture failed", error);
  }
}
