import { randomUUID } from 'node:crypto'

export interface ApiRequestContext {
  requestId: string
  cacheTtlMs: number
}

export function buildRequestContext(request: Request): ApiRequestContext {
  const requestId = request.headers.get('x-request-id') ?? randomUUID()
  return {
    requestId,
    cacheTtlMs: Number.parseInt(request.headers.get('x-cache-ttl') ?? '60000', 10)
  }
}
