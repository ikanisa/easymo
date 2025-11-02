export interface SuccessResponse<T> {
  data: T
  requestId: string
  meta?: Record<string, unknown>
}

export function createSuccessResponse<T>({
  data,
  requestId,
  status = 200,
  meta
}: {
  data: T
  requestId: string
  status?: number
  meta?: Record<string, unknown>
}): Response {
  const body: SuccessResponse<T> = {
    data,
    requestId,
    ...(meta ? { meta } : {})
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  })
}
