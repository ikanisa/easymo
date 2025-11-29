// Usage tracking and analytics

export interface UsageEvent {
  timestamp: string;
  userId?: string;
  endpoint: string;
  provider: "openai" | "gemini";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  totalCost: number;
  averageDuration: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byEndpoint: Record<string, number>;
}

class UsageTracker {
  private events: UsageEvent[] = [];
  private maxEvents = 10000; // Keep last 10k events

  track(event: UsageEvent) {
    this.events.push(event);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log for monitoring
    console.log("[USAGE]", {
      endpoint: event.endpoint,
      provider: event.provider,
      duration: event.duration,
      tokens: event.totalTokens,
      cost: event.cost,
      success: event.success,
    });
  }

  getStats(since?: Date): UsageStats {
    const filtered = since
      ? this.events.filter((e) => new Date(e.timestamp) >= since)
      : this.events;

    const stats: UsageStats = {
      totalRequests: filtered.length,
      successfulRequests: filtered.filter((e) => e.success).length,
      failedRequests: filtered.filter((e) => !e.success).length,
      totalTokens: filtered.reduce((sum, e) => sum + (e.totalTokens || 0), 0),
      totalCost: filtered.reduce((sum, e) => sum + (e.cost || 0), 0),
      averageDuration:
        filtered.reduce((sum, e) => sum + e.duration, 0) / (filtered.length || 1),
      byProvider: {},
      byModel: {},
      byEndpoint: {},
    };

    // Group by provider
    filtered.forEach((e) => {
      stats.byProvider[e.provider] = (stats.byProvider[e.provider] || 0) + 1;
      stats.byModel[e.model] = (stats.byModel[e.model] || 0) + 1;
      stats.byEndpoint[e.endpoint] = (stats.byEndpoint[e.endpoint] || 0) + 1;
    });

    return stats;
  }

  getRecentEvents(limit: number = 100): UsageEvent[] {
    return this.events.slice(-limit);
  }

  clear() {
    this.events = [];
  }
}

export const usageTracker = new UsageTracker();

// Cost estimation (approximate)
export function estimateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Costs per 1M tokens (USD)
  const pricing: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    "gemini-2.0-flash-exp": { input: 0, output: 0 }, // Free tier
    "gemini-1.5-pro": { input: 1.25, output: 5 },
    "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  };

  const costs = pricing[model] || { input: 0, output: 0 };
  const inputCost = (inputTokens / 1000000) * costs.input;
  const outputCost = (outputTokens / 1000000) * costs.output;

  return inputCost + outputCost;
}

// Wrapper to track API calls
export async function trackApiCall<T>(
  endpoint: string,
  provider: "openai" | "gemini",
  model: string,
  fn: () => Promise<T>,
  userId?: string
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let error: string | undefined;
  let result: T;

  try {
    result = await fn();
    return result;
  } catch (err) {
    success = false;
    error = (err as Error).message;
    throw err;
  } finally {
    const duration = Date.now() - startTime;

    usageTracker.track({
      timestamp: new Date().toISOString(),
      userId,
      endpoint,
      provider,
      model,
      duration,
      success,
      error,
      // Token counts would come from API response
    });
  }
}
