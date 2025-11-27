interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

class MetricsCollector {
  private metrics: Metric[] = [];
  private maxMetrics = 10000;

  record(name: string, value: number, tags?: Record<string, string>): void {
    // Cleanup old metrics if needed
    if (this.metrics.length >= this.maxMetrics) {
      this.metrics.shift();
    }

    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });
  }

  increment(name: string, tags?: Record<string, string>): void {
    this.record(name, 1, tags);
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.record(name, value, tags);
  }

  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.record(name, durationMs, { ...tags, type: 'timing' });
  }

  getMetrics(
    name?: string,
    since?: number
  ): Metric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter((m) => m.name === name);
    }

    if (since) {
      filtered = filtered.filter((m) => m.timestamp >= since);
    }

    return filtered;
  }

  getStats(name: string, since?: number): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  } | null {
    const metrics = this.getMetrics(name, since);

    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map((m) => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      sum,
      avg: sum / metrics.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  clear(): void {
    this.metrics = [];
  }
}

export const metrics = new MetricsCollector();

// Helper to measure async function execution time
export async function measureAsync<T>(
  metricName: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    metrics.timing(metricName, Date.now() - start, { ...tags, status: 'success' });
    return result;
  } catch (error) {
    metrics.timing(metricName, Date.now() - start, { ...tags, status: 'error' });
    throw error;
  }
}
