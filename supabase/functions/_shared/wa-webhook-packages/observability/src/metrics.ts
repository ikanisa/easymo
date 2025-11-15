// Metrics collection utilities

interface MetricData {
  name: string;
  value: number;
  timestamp: string;
  dimensions: Record<string, string | number>;
}

const metrics: MetricData[] = [];

export function incrementMetric(
  name: string,
  value = 1,
  dimensions: Record<string, string | number> = {}
): void {
  metrics.push({
    name,
    value,
    timestamp: new Date().toISOString(),
    dimensions,
  });
}

export function recordLatency(
  operation: string,
  durationMs: number,
  dimensions: Record<string, string | number> = {}
): void {
  incrementMetric(`${operation}_latency_ms`, durationMs, dimensions);
}

export function getMetrics(): MetricData[] {
  return [...metrics];
}

export function clearMetrics(): void {
  metrics.length = 0;
}

export function exportPrometheusMetrics(): string {
  const lines: string[] = [];
  const metricGroups = new Map<string, MetricData[]>();

  // Group metrics by name
  for (const metric of metrics) {
    const existing = metricGroups.get(metric.name) ?? [];
    existing.push(metric);
    metricGroups.set(metric.name, existing);
  }

  // Export each metric group
  for (const [name, group] of metricGroups) {
    lines.push(`# TYPE ${name} counter`);
    for (const metric of group) {
      const labels = Object.entries(metric.dimensions)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      const labelsStr = labels ? `{${labels}}` : "";
      lines.push(`${name}${labelsStr} ${metric.value}`);
    }
  }

  return lines.join("\n");
}
