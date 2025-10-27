/**
 * Prometheus-compatible metrics collection utility
 * 
 * Provides counters, histograms, and gauges for monitoring
 * API response times, success/failure rates, and latencies.
 */

export interface MetricLabels {
  [key: string]: string | number;
}

export interface CounterMetric {
  name: string;
  help: string;
  value: number;
  labels?: MetricLabels;
}

export interface HistogramMetric {
  name: string;
  help: string;
  value: number;
  labels?: MetricLabels;
}

export interface GaugeMetric {
  name: string;
  help: string;
  value: number;
  labels?: MetricLabels;
}

interface MetricStore {
  counters: Map<string, { help: string; value: number; labels: MetricLabels }>;
  histograms: Map<string, { help: string; observations: number[]; labels: MetricLabels }>;
  gauges: Map<string, { help: string; value: number; labels: MetricLabels }>;
}

class MetricsCollector {
  private store: MetricStore = {
    counters: new Map(),
    histograms: new Map(),
    gauges: new Map(),
  };
  
  private drainUrl: string | null = null;
  private initialized = false;
  private flushInterval: NodeJS.Timeout | null = null;

  private ensureInitialized(): void {
    if (this.initialized) return;
    this.drainUrl = process.env.METRICS_DRAIN_URL ?? null;
    this.initialized = true;

    // Auto-flush metrics every 60 seconds if drain URL is configured
    if (this.drainUrl) {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, 60000);
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, help: string, value = 1, labels: MetricLabels = {}): void {
    this.ensureInitialized();
    const key = this.buildKey(name, labels);
    
    const existing = this.store.counters.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.store.counters.set(key, { help, value, labels });
    }

    // Forward to external drain if configured
    if (this.drainUrl) {
      this.sendMetric({ name, value, labels, type: 'counter' });
    }
  }

  /**
   * Record a histogram observation (for measuring latencies, response times)
   */
  recordHistogram(name: string, help: string, value: number, labels: MetricLabels = {}): void {
    this.ensureInitialized();
    const key = this.buildKey(name, labels);
    
    const existing = this.store.histograms.get(key);
    if (existing) {
      existing.observations.push(value);
    } else {
      this.store.histograms.set(key, { help, observations: [value], labels });
    }

    // Forward to external drain if configured
    if (this.drainUrl) {
      this.sendMetric({ name, value, labels, type: 'histogram' });
    }
  }

  /**
   * Set a gauge metric (for measuring current values)
   */
  setGauge(name: string, help: string, value: number, labels: MetricLabels = {}): void {
    this.ensureInitialized();
    const key = this.buildKey(name, labels);
    this.store.gauges.set(key, { help, value, labels });

    // Forward to external drain if configured
    if (this.drainUrl) {
      this.sendMetric({ name, value, labels, type: 'gauge' });
    }
  }

  /**
   * Get Prometheus-compatible metrics output
   */
  getMetrics(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, metric] of this.store.counters.entries()) {
      lines.push(`# HELP ${metric.help}`);
      lines.push(`# TYPE counter`);
      lines.push(`${key} ${metric.value}`);
    }

    // Histograms
    for (const [key, metric] of this.store.histograms.entries()) {
      const sorted = [...metric.observations].sort((a, b) => a - b);
      const sum = sorted.reduce((acc, val) => acc + val, 0);
      const count = sorted.length;

      lines.push(`# HELP ${metric.help}`);
      lines.push(`# TYPE histogram`);
      lines.push(`${key}_sum ${sum}`);
      lines.push(`${key}_count ${count}`);
      
      // Add percentiles
      if (count > 0) {
        const p50 = sorted[Math.floor(count * 0.5)];
        const p95 = sorted[Math.floor(count * 0.95)];
        const p99 = sorted[Math.floor(count * 0.99)];
        lines.push(`${key}_p50 ${p50}`);
        lines.push(`${key}_p95 ${p95}`);
        lines.push(`${key}_p99 ${p99}`);
      }
    }

    // Gauges
    for (const [key, metric] of this.store.gauges.entries()) {
      lines.push(`# HELP ${metric.help}`);
      lines.push(`# TYPE gauge`);
      lines.push(`${key} ${metric.value}`);
    }

    return lines.join('\n');
  }

  /**
   * Flush all metrics (for graceful shutdown)
   */
  flush(): void {
    if (this.drainUrl) {
      const metricsData = this.getMetrics();
      void fetch(this.drainUrl, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: metricsData,
      }).catch((err) => {
        console.error('metrics_drain_failed', err);
      });
    }
  }

  /**
   * Clear all metrics (useful for testing)
   */
  reset(): void {
    this.store.counters.clear();
    this.store.histograms.clear();
    this.store.gauges.clear();
  }

  /**
   * Stop auto-flushing
   */
  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }

  private buildKey(name: string, labels: MetricLabels): string {
    if (Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private sendMetric(data: { name: string; value: number; labels: MetricLabels; type: string }): void {
    void fetch(this.drainUrl!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, ts: Date.now() }),
    }).catch((err) => {
      console.error('metric_send_failed', err);
    });
  }
}

// Singleton instance
const collector = new MetricsCollector();

// Graceful shutdown
process.on('SIGTERM', () => collector.shutdown());
process.on('SIGINT', () => collector.shutdown());

export const metricsCollector = collector;

/**
 * Helper to measure operation duration and record as histogram
 */
export async function measureDuration<T>(
  metricName: string,
  operation: () => Promise<T>,
  labels: MetricLabels = {},
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - start;
    collector.recordHistogram(metricName, `Duration of ${metricName}`, duration, labels);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    collector.recordHistogram(metricName, `Duration of ${metricName}`, duration, { ...labels, status: 'error' });
    throw error;
  }
}

/**
 * Track success/failure rates
 */
export async function trackOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  labels: MetricLabels = {},
): Promise<T> {
  try {
    const result = await operation();
    collector.incrementCounter(
      `${operationName}_total`,
      `Total ${operationName} operations`,
      1,
      { ...labels, status: 'success' },
    );
    return result;
  } catch (error) {
    collector.incrementCounter(
      `${operationName}_total`,
      `Total ${operationName} operations`,
      1,
      { ...labels, status: 'error' },
    );
    throw error;
  }
}
