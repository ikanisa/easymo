"use client";

import type { ComponentProps } from "react";

/**
 * Lightweight analytics adapter used to decouple the app from any vendor SDK.
 *
 * The real implementation can be swapped in without touching the call sites.
 * For now, we intentionally no-op to keep the runtime free of hosted
 * platform dependencies while we build the replacement data pipeline.
 */
export type TrackEvent =
  | string
  | {
      /**
       * Canonical identifier for the event.
       */
      event: string;
      /**
       * Optional set of structured properties associated with the event.
       */
      properties?: Record<string, unknown>;
    };

/**
 * Emits an analytics event. The current implementation is a no-op, but the
 * signature matches the one we use across the app so we can drop in a
 * production tracker later without touching consumers.
 */
export async function track(
  event: TrackEvent,
  properties?: Record<string, unknown>
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    const payload =
      typeof event === "string"
        ? { event, properties }
        : { event: event.event, properties: event.properties ?? properties };

    if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true") {
      console.debug("[analytics:noop]", payload);
    }
  }
}

export type AnalyticsProps = ComponentProps<"script"> & {
  /**
   * Allows future adapters to perform final mutation before the payload leaves
   * the browser. Ignored by the current noop implementation.
   */
  beforeSend?: (event: unknown) => unknown;
};

/**
 * Client component placeholder so layouts can keep their JSX tree unchanged
 * while the analytics backend is migrated to the new self-hosted pipeline.
 */
export function Analytics(_props: AnalyticsProps): null {
  void _props;
  return null;
}
