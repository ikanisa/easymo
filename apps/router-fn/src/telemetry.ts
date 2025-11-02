interface DownstreamError {
  destination: string;
  status: number;
  message: string;
}

export class TelemetryCollector {
  private counts: Record<string, number> = {
    received: 0,
    routed: 0,
    duplicates: 0,
    rateLimited: 0,
    unknownKeywords: 0,
    downstreamErrors: 0,
    destinationsInvoked: 0,
  };
  private unknownKeywordSamples = new Set<string>();
  private downstreamErrors: DownstreamError[] = [];

  recordReceived(): void {
    this.counts.received += 1;
  }

  recordDuplicate(): void {
    this.counts.duplicates += 1;
  }

  recordRateLimited(): void {
    this.counts.rateLimited += 1;
  }

  recordUnknownKeyword(keyword?: string): void {
    this.counts.unknownKeywords += 1;
    if (keyword) {
      this.unknownKeywordSamples.add(keyword);
    }
  }

  recordRouted(destinations: number): void {
    this.counts.routed += 1;
    this.counts.destinationsInvoked += destinations;
  }

  recordDownstreamError(destination: string, status: number, message: string): void {
    this.counts.downstreamErrors += 1;
    this.downstreamErrors.push({ destination, status, message });
  }

  snapshot(): Record<string, unknown> {
    return {
      counts: { ...this.counts },
      unknownKeywords: Array.from(this.unknownKeywordSamples),
      downstreamErrors: [...this.downstreamErrors],
    };
  }
}
