import type { Event, EventHint } from "@sentry/types";

import { parseSampleRate } from "./env";
import { scrubPII } from "./pii";

/**
 * Scrubs PII from Sentry events before sending them.
 */
export function scrubSentryEvent<T extends Event>(event: T, _hint?: EventHint): T {
  if (!event) {
    return event;
  }

  const scrubbed: T = { ...event };

  if (scrubbed.request?.data) {
    scrubbed.request = {
      ...scrubbed.request,
      data: scrubPII(scrubbed.request.data),
    };
  }

  if (scrubbed.user) {
    scrubbed.user = scrubPII(scrubbed.user);
  }

  if (scrubbed.extra) {
    scrubbed.extra = scrubPII(scrubbed.extra);
  }

  if (scrubbed.contexts) {
    scrubbed.contexts = scrubPII(scrubbed.contexts);
  }

  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      message: breadcrumb.message ? scrubPII(breadcrumb.message) : breadcrumb.message,
      data: breadcrumb.data ? scrubPII(breadcrumb.data) : breadcrumb.data,
    }));
  }

  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map((value) => ({
        ...value,
        value: value.value ? scrubPII(value.value) : value.value,
        stacktrace: value.stacktrace ? scrubPII(value.stacktrace) : value.stacktrace,
      })),
    };
  }

  return scrubbed;
}

const coerceSampleRateInput = (input: string | number | null | undefined): string | undefined => {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      return undefined;
    }
    return input.toString();
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
};

export interface CreateSentryOptionsInput {
  readonly dsn?: string | null;
  readonly environment: string;
  readonly release?: string;
  readonly tracesSampleRate?: string | number | null;
  readonly profilesSampleRate?: string | number | null;
  readonly defaultTracesSampleRate?: number;
  readonly defaultProfilesSampleRate?: number;
  readonly scrub?: typeof scrubSentryEvent;
  readonly extraOptions?: Record<string, unknown>;
}

export type SentryInitOptions = {
  readonly dsn?: string;
  readonly environment: string;
  readonly release?: string;
  readonly enabled: boolean;
  readonly tracesSampleRate: number;
  readonly profilesSampleRate: number;
  readonly beforeSend: typeof scrubSentryEvent;
} & Record<string, unknown>;

/**
 * Builds a Sentry options object with consistent sampling and PII scrubbing.
 */
export function createSentryOptions({
  dsn,
  environment,
  release,
  tracesSampleRate,
  profilesSampleRate,
  defaultTracesSampleRate,
  defaultProfilesSampleRate,
  scrub,
  extraOptions,
}: CreateSentryOptionsInput): SentryInitOptions {
  const scrubber = scrub ?? scrubSentryEvent;

  const resolvedTracesSampleRate = parseSampleRate(
    coerceSampleRateInput(tracesSampleRate),
    defaultTracesSampleRate ?? (environment === "production" ? 0.2 : 1)
  );

  const resolvedProfilesSampleRate = parseSampleRate(
    coerceSampleRateInput(profilesSampleRate),
    defaultProfilesSampleRate ?? (environment === "production" ? 0.1 : 1)
  );

  return {
    dsn: dsn || undefined,
    environment,
    release,
    enabled: Boolean(dsn),
    tracesSampleRate: resolvedTracesSampleRate,
    profilesSampleRate: resolvedProfilesSampleRate,
    beforeSend: scrubber,
    ...(extraOptions ?? {}),
  } satisfies SentryInitOptions;
}
