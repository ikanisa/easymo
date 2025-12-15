import { logStructuredEvent } from "../_shared/observability.ts";

type LatencyConfig = {
  windowSize: number;
  coldStartSloMs: number;
  p95SloMs: number;
};

export class LatencyTracker {
  #windowSize: number;
  #coldStartSloMs: number;
  #p95SloMs: number;
  #samples: number[] = [];
  #hasRecordedColdStart = false;

  constructor(config: LatencyConfig) {
    this.#windowSize = Math.max(10, config.windowSize);
    this.#coldStartSloMs = config.coldStartSloMs;
    this.#p95SloMs = config.p95SloMs;
  }

  recordColdStart(startMarker: number, requestStart: number, correlationId: string) {
    if (this.#hasRecordedColdStart) return;
    const coldStartMs = requestStart - startMarker;
    this.#hasRecordedColdStart = true;
    const healthy = coldStartMs <= this.#coldStartSloMs;
    logStructuredEvent("WA_CORE_COLD_START", {
      coldStartMs: Math.round(coldStartMs),
      withinSlo: healthy,
      correlationId,
    });
    if (!healthy) {
      logStructuredEvent("WA_CORE_COLD_START_SLO_BREACH", {
        coldStartMs: Math.round(coldStartMs),
        slo: this.#coldStartSloMs,
      }, "warn");
    }
  }

  recordLatency(latencyMs: number, correlationId: string): number {
    this.#samples.push(latencyMs);
    if (this.#samples.length > this.#windowSize) {
      this.#samples.shift();
    }

    const p95 = this.#calculatePercentile(95);
    const breach = p95 > this.#p95SloMs;

    logStructuredEvent("WA_CORE_LATENCY", {
      correlationId,
      latencyMs: Math.round(latencyMs),
      p95: Math.round(p95) || 0,
      windowSize: this.#samples.length,
      slo: this.#p95SloMs,
      withinSlo: !breach,
    });

    if (breach) {
      logStructuredEvent("WA_CORE_LATENCY_SLO_BREACH", {
        p95: Math.round(p95),
        slo: this.#p95SloMs,
        sampleCount: this.#samples.length,
      }, "warn");
    }

    return latencyMs;
  }

  #calculatePercentile(percentile: number): number {
    if (this.#samples.length === 0) return 0;
    const sorted = [...this.#samples].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}
