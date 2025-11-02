import { z } from 'zod'
import { ensureFeatureEnabled, type FeatureFlag } from './featureFlags'
import { toStructuredError } from './errors'
import { createSuccessResponse } from './response'
import { buildRequestContext } from './request'
import type { QueryCache } from '@easymo/clients'
import { instrumentedQuery } from '@easymo/clients'
import { createRequestCache } from './cache'
import { createMetricsCollector } from './metrics'
import { log } from './logger'

export interface HandlerConfig<Schema extends z.ZodTypeAny, Result> {
  featureFlag: FeatureFlag
  schema: Schema
  handler: (input: z.infer<Schema>, context: HandlerContext) => Promise<Result>
  status?: number
}

export interface HandlerContext {
  request: Request
  requestId: string
  cache: QueryCache
  cacheTtlMs: number
  metrics: ReturnType<typeof createMetricsCollector>
  query<T>(args: {
    span: string
    cacheKey?: string
    exec: () => Promise<T>
    thresholdMs?: number
  }): Promise<T>
}

export function createRouteHandler<Schema extends z.ZodTypeAny, Result>({
  featureFlag,
  schema,
  handler,
  status = 200
}: HandlerConfig<Schema, Result>) {
  return async function route(request: Request): Promise<Response> {
    const context = buildRequestContext(request)
    const requestId = context.requestId
    try {
      ensureFeatureEnabled(featureFlag)
      const body = request.method === 'GET' ? Object.fromEntries(new URL(request.url).searchParams) : await request.json()
      const result = schema.parse(body)
      const cache = createRequestCache(1024, context.cacheTtlMs)
      const metrics = createMetricsCollector()
      const handlerContext: HandlerContext = {
        request,
        requestId,
        cache,
        cacheTtlMs: context.cacheTtlMs,
        metrics,
        async query<T>({ span, cacheKey, exec, thresholdMs }: {
          span: string
          cacheKey?: string
          exec: () => Promise<T>
          thresholdMs?: number
        }): Promise<T> {
          return instrumentedQuery({
            span,
            cache,
            cacheKey,
            requestId,
            collector: metrics,
            thresholdMs: thresholdMs ?? 120,
            ttlMs: context.cacheTtlMs,
            exec
          })
        }
      }

      log({
        level: 'info',
        message: `Handling ${featureFlag} request`,
        requestId,
        context: { method: request.method, url: request.url }
      })

      const data = await handler(result, handlerContext)
      return createSuccessResponse({ data, requestId, status, meta: { metrics: handlerContext.metrics.toJSON() } })
    } catch (error) {
      return toStructuredError(error, requestId)
    }
  }
}
