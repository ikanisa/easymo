import { logMetric } from "./logging.ts";

type MetricDimensions = Record<string, string | number | boolean | null | undefined>;

function normaliseDimensions(dimensions: MetricDimensions): Record<string, string> {
  const entries = Object.entries(dimensions)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)] as const);
  return Object.fromEntries(entries);
}

async function safeLogMetric(
  name: string,
  value: number,
  dimensions: MetricDimensions,
): Promise<void> {
  try {
    await logMetric(name, value, normaliseDimensions(dimensions));
  } catch (error) {
    logStructuredEvent("ERROR", { error: "metrics.emit_failed", { name, error } }, "error");
  }
}

export async function recordMetric(
  name: string,
  value = 1,
  dimensions: MetricDimensions = {},
): Promise<void> {
  await safeLogMetric(name, value, dimensions);
}

export async function recordDurationMetric(
  name: string,
  startedAt: number,
  dimensions: MetricDimensions = {},
): Promise<void> {
  const durationMs = Date.now() - startedAt;
  await safeLogMetric(name, durationMs, { ...dimensions, unit: "ms" });
}

export async function recordGauge(
  name: string,
  value: number,
  dimensions: MetricDimensions = {},
): Promise<void> {
  await safeLogMetric(name, value, { ...dimensions, gauge: "true" });
}
