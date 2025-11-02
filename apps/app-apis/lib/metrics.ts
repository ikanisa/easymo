import type { PerfCollector, PerfSample } from '@easymo/clients'

export class RequestMetricsCollector implements PerfCollector {
  private readonly samples: PerfSample[] = []

  record(sample: PerfSample): void {
    this.samples.push(sample)
  }

  toJSON() {
    return this.samples
  }
}

export function createMetricsCollector(): RequestMetricsCollector {
  return new RequestMetricsCollector()
}
