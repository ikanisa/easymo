import { logStructured } from "./logger";
import { emitMetric } from "./metrics";

export type ObservabilityContext = {
  log: typeof logStructured;
  recordMetric: (name: string, value: number, tags?: Record<string, unknown>) => void;
};

export async function withApiObservability<T>(
  name: string,
  request: Request,
  handler: (ctx: ObservabilityContext) => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const ctx: ObservabilityContext = {
    log: (payload) => logStructured({ target: name, ...payload }),
    recordMetric: (metricName, metricValue, metricTags) => {
      emitMetric(metricName, metricValue, {
        method: request.method,
        ...(metricTags ?? {}),
      });
    },
  };

  try {
    const result = await handler(ctx);
    const duration = Date.now() - start;
    ctx.log({
      event: `${name}.success`,
      status: 'ok',
      tags: {
        method: request.method,
        duration_ms: duration,
      },
    });
    emitMetric(`${name}.duration_ms`, duration, { method: request.method, status: "ok" });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    emitMetric(`${name}.duration_ms`, duration, { method: request.method, status: "error" });
    ctx.log({
      event: `${name}.error`,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      tags: {
        method: request.method,
        duration_ms: duration,
      },
    });
    throw error;
  }
}
