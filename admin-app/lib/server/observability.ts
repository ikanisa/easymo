import { logStructured } from "./logger";

export type ObservabilityContext = {
  log: typeof logStructured;
  recordMetric: (name: string, value: number, tags?: Record<string, unknown>) => void;
};

export function withApiObservability<T>(
  name: string,
  request: Request,
  handler: (ctx: ObservabilityContext) => Promise<T>,
): Promise<T> {
  const start = Date.now();

  const ctx: ObservabilityContext = {
    log: logStructured,
    recordMetric: (_name, _value, _tags) => {
      // TODO integrate with metrics backend
    },
  };

  return handler(ctx).finally(() => {
    const duration = Date.now() - start;
    ctx.log({
      event: `${name}.completed`,
      target: name,
      status: "ok",
      tags: {
        method: request.method,
        duration_ms: duration,
      },
    });
  });
}
