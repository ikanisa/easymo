import type { ObservabilityContext } from "@/lib/server/observability";
import { withApiObservability } from "@/lib/server/observability";
import { jsonError } from "@/lib/api/http";
import { captureException } from "@/lib/server/sentry";

export type ApiHandler<T = unknown> = (
  request: Request,
  context: T,
  observability: ObservabilityContext,
) => Promise<Response>;

export function createHandler<TContext = unknown>(
  name: string,
  handler: ApiHandler<TContext>,
) {
  return async (request: Request, context?: TContext) => {
    try {
      const ctxValue = (context ?? ({} as TContext));
      return await withApiObservability(name, request, (obs) => handler(request, ctxValue, obs));
    } catch (error) {
      console.error(`${name}.unhandled`, error);
      captureException(error as Error, { route: name, path: (request as any)?.url });
      return jsonError({ error: "unexpected_error", message: "Unhandled server error." }, 500);
    }
  };
}
