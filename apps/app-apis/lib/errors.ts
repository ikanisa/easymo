import { z } from 'zod'

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'UNPROCESSABLE_ENTITY'
  | 'INTERNAL_SERVER_ERROR'

export interface StructuredError {
  code: ErrorCode
  message: string
  requestId: string
  details?: Record<string, unknown>
}

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor({
    code,
    message,
    status,
    details
  }: {
    code: ErrorCode
    message: string
    status: number
    details?: Record<string, unknown>
  }) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

export function fromZodError(error: z.ZodError, requestId: string): Response {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message
  }))

  return createErrorResponse({
    error: {
      code: 'BAD_REQUEST',
      message: 'The request payload is invalid.',
      details: { issues },
      requestId
    },
    status: 400
  })
}

export function createErrorResponse({
  error,
  status
}: {
  error: StructuredError
  status: number
}): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  })
}

export function toStructuredError(error: unknown, requestId: string): Response {
  if (error instanceof ApiError) {
    return createErrorResponse({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId
      },
      status: error.status
    })
  }

  if (error instanceof z.ZodError) {
    return fromZodError(error, requestId)
  }

  return createErrorResponse({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId
    },
    status: 500
  })
}
