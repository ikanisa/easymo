# Error Handling Standard

**Last Updated:** 2025-01-17  
**Purpose:** Standardize error handling across all Edge Functions

## Overview

All Edge Functions should follow this standardized error handling pattern for consistency, observability, and better user experience.

## Error Classes

Use the standardized error classes from `_shared/errors.ts`:

```typescript
import {
  WebhookError,
  ValidationError,
  SignatureError,
  RateLimitError,
  ProcessingError,
  ExternalServiceError,
  TimeoutError,
  CircuitBreakerOpenError,
} from "../_shared/errors.ts";
```

### Error Types

| Error Class | Status Code | Retryable | Use Case |
|------------|-------------|-----------|----------|
| `ValidationError` | 400 | No | Invalid input data |
| `SignatureError` | 401 | No | Invalid webhook signature |
| `RateLimitError` | 429 | Yes | Rate limit exceeded |
| `ProcessingError` | 500 | Yes | Processing failure |
| `ExternalServiceError` | 502 | Yes | External API failure |
| `TimeoutError` | 504 | Yes | Operation timeout |
| `CircuitBreakerOpenError` | 503 | Yes | Circuit breaker open |

## Standard Pattern

### 1. Try-Catch with Structured Logging

```typescript
import { logStructuredEvent, logError } from "../_shared/observability.ts";
import { classifyError, serializeError } from "./utils/error-handling.ts";

try {
  // Your operation
  const result = await processRequest(req);
  return respond({ success: true, data: result });
} catch (error) {
  const { message, stack, code } = serializeError(error);
  const { isUserError, isSystemError, statusCode } = classifyError(error);
  
  logStructuredEvent("OPERATION_ERROR", {
    error: message,
    errorCode: code,
    errorType: isUserError ? "user_error" : (isSystemError ? "system_error" : "unknown_error"),
    stack,
    correlationId,
  }, isSystemError ? "error" : "warn");
  
  return respond({
    error: isUserError ? "invalid_request" : (isSystemError ? "service_unavailable" : "internal_error"),
    message: isUserError ? message : "An error occurred. Please try again later.",
  }, { status: statusCode });
}
```

### 2. Using Error Handler Middleware

```typescript
import { createSafeHandler } from "../_shared/error-handler.ts";

const handler = createSafeHandler(
  async (req: Request) => {
    // Your handler logic
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  },
  "my_function_handler"
);

serve(handler);
```

### 3. Using Error Boundary

```typescript
import { withErrorBoundary } from "../_shared/error-handler.ts";

const result = await withErrorBoundary(
  async () => {
    return await processOperation();
  },
  {
    operationName: "process_operation",
    userId: user.id,
    correlationId: req.headers.get("x-correlation-id") || crypto.randomUUID(),
  }
);
```

## Error Response Format

All error responses should follow this format:

```typescript
{
  error: "error_code",
  message: "User-friendly error message",
  correlationId?: string,
  retryable?: boolean
}
```

## Logging Requirements

1. **Always log errors** with structured logging
2. **Include correlation ID** for tracing
3. **Classify error type** (user vs system)
4. **Include stack traces** for system errors
5. **Use appropriate log levels**:
   - `error`: System errors, critical failures
   - `warn`: User errors, recoverable issues
   - `info`: Expected errors (rate limits, etc.)

## Best Practices

1. ✅ **Use specific error classes** instead of generic Error
2. ✅ **Always include correlation IDs** in error logs
3. ✅ **Provide user-friendly messages** for user errors
4. ✅ **Log system errors with full context** (stack, context)
5. ✅ **Don't expose internal details** in user-facing errors
6. ✅ **Use error boundaries** for complex operations
7. ✅ **Handle retries** for retryable errors

## Migration Guide

To migrate existing code:

1. Import error classes from `_shared/errors.ts`
2. Replace generic `Error` with specific error classes
3. Add structured logging with `logStructuredEvent`
4. Use `classifyError` and `serializeError` utilities
5. Return standardized error responses

## Examples

See:
- `supabase/functions/notify-buyers/index.ts` - Good example
- `supabase/functions/wa-webhook-profile/index.ts` - Good example
- `supabase/functions/_shared/error-handler.ts` - Reference implementation

