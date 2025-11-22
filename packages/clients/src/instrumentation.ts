export interface PerfSample {
  span: string
  durationMs: number
  requestId: string
  metadata?: Record<string, unknown>
}

export interface PerfCollector {
  record(sample: PerfSample): void
}

export interface InstrumentationOptions<T> {
  cacheKey?: string
  cache?: import('./cache').QueryCache
  ttlMs?: number
  span: string
  requestId: string
  collector?: PerfCollector
  metadata?: Record<string, unknown>
  thresholdMs?: number
  exec: () => Promise<T>
}

export async function instrumentedQuery<T>({
  cacheKey,
  cache,
  ttlMs,
  span,
  requestId,
  collector,
  metadata,
  thresholdMs,
  exec
}: InstrumentationOptions<T>): Promise<T> {
  if (cache && cacheKey) {
    const cached = cache.get<T>(cacheKey)
    if (cached) {
      collector?.record({
        span,
        durationMs: 0,
        requestId,
        metadata: { ...metadata, cache: 'hit' }
      })
      return cached
    }
  }

  const start = performance.now()
  const result = await exec()
  const durationMs = performance.now() - start

  if (cache && cacheKey) {
    cache.set(cacheKey, result, ttlMs)
  }

  if (collector) {
    collector.record({
      span,
      durationMs,
      requestId,
      metadata: {
        ...metadata,
        cache: cacheKey ? 'miss' : undefined,
        ...(thresholdMs ? { thresholdMs } : {})
      }
    })
  }

  if (thresholdMs && durationMs > thresholdMs) {
     
    console.warn(
      `Span ${span} for request ${requestId} exceeded threshold ${thresholdMs}ms with ${durationMs.toFixed(2)}ms`
    )
  }

  return result
}
