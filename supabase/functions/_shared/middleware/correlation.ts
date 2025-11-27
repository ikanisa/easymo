/**
 * Correlation ID Middleware
 * 
 * Ensures all requests have a correlation ID for distributed tracing.
 * The correlation ID is:
 * - Extracted from X-Correlation-ID header if present
 * - Generated if not present
 * - Added to response headers
 * - Available to the handler function
 * 
 * Usage:
 * ```typescript
 * import { withCorrelationId } from "../_shared/middleware/correlation.ts";
 * 
 * Deno.serve(withCorrelationId(async (req, correlationId) => {
 *   await logStructuredEvent("REQUEST_RECEIVED", { correlationId });
 *   return new Response("OK");
 * }));
 * ```
 */

export type CorrelationHandler = (
  req: Request,
  correlationId: string
) => Promise<Response> | Response;

/**
 * Wrap a handler function with correlation ID handling
 */
export function withCorrelationId(handler: CorrelationHandler) {
  return async (req: Request): Promise<Response> => {
    // Extract or generate correlation ID
    const correlationId =
      req.headers.get("x-correlation-id") ||
      req.headers.get("X-Correlation-ID") ||
      crypto.randomUUID();

    try {
      // Call handler with correlation ID
      const response = await handler(req, correlationId);

      // Add correlation ID to response headers
      response.headers.set("X-Correlation-ID", correlationId);

      return response;
    } catch (error) {
      // Log error with correlation ID
      console.error("Request failed", {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Return error response with correlation ID
      const errorResponse = new Response(
        JSON.stringify({
          error: "Internal server error",
          correlationId,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-ID": correlationId,
          },
        }
      );

      return errorResponse;
    }
  };
}

/**
 * Extract correlation ID from request (for use without middleware)
 */
export function getCorrelationId(req: Request): string {
  return (
    req.headers.get("x-correlation-id") ||
    req.headers.get("X-Correlation-ID") ||
    crypto.randomUUID()
  );
}
