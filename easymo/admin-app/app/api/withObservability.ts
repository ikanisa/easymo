import { NextResponse } from "next/server";
import type { ObservabilityContext } from "@/lib/server/observability";
import { withApiObservability } from "@/lib/server/observability";

export type ApiHandler<T extends unknown = unknown> = (
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
      return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
    }
  };
}
