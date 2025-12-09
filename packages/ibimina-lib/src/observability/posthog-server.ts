import { PostHog } from "posthog-node";

import { parseSampleRate, resolveEnvironment } from "./env";
import { scrubPII } from "./pii";
import { shouldSampleEvent } from "./sampling";

let client: PostHog | null = null;

const environment = resolveEnvironment();
const defaultServerSampleRate = parseSampleRate(
  process.env.POSTHOG_SERVER_SAMPLE_RATE ?? process.env.POSTHOG_CAPTURE_SAMPLE_RATE,
  environment === "production" ? 0.35 : 1
);

function getClient(): PostHog | null {
  if (client) {
    return client;
  }

  const apiKey = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    return null;
  }

  client = new PostHog(apiKey, {
    host:
      process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  return client;
}

export type CaptureServerEventOptions = {
  readonly sampleRate?: number;
};

export async function captureServerEvent(
  event: string,
  properties: Record<string, unknown> = {},
  distinctId = "system",
  options: CaptureServerEventOptions = {}
): Promise<void> {
  const instance = getClient();
  if (!instance) {
    return;
  }

  const sampleRate = options.sampleRate ?? defaultServerSampleRate;
  if (!shouldSampleEvent({ event, distinctId, sampleRate })) {
    return;
  }

  try {
    instance.capture({
      distinctId,
      event,
      properties: {
        ...scrubPII(properties),
        app: properties.app ?? "admin",
      },
    });

    const flushAsync = (instance as unknown as { flushAsync?: () => Promise<void> }).flushAsync;
    if (typeof flushAsync === "function") {
      await flushAsync.call(instance).catch((error) => {
        console.warn("[posthog] flushAsync failed", error);
      });
    } else {
      await new Promise<void>((resolve) => {
        (instance as unknown as { flush: (callback: (err?: Error) => void) => void }).flush(
          (err) => {
            if (err) {
              console.warn("[posthog] flush failed", err);
            }
            resolve();
          }
        );
      });
    }
  } catch (error) {
    console.warn("[posthog] capture failed", error);
  }
}
