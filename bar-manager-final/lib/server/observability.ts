import { logStructured } from "./logger";
import { emitMetric } from "./metrics";

export type ObservabilityContext = {
  log: typeof logStructured;
  recordMetric: (name: string, value: number, tags?: Record<string, unknown>) => void;
  requestId: string;
};

export async function withApiObservability<T>(
  name: string,
  request: Request,
  handler: (ctx: ObservabilityContext) => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const requestId = (request.headers as any)?.get?.('x-request-id') || crypto.randomUUID();
  const ctx: ObservabilityContext = {
    log: (payload) => logStructured({ target: name, tags: { request_id: requestId }, ...payload }),
    recordMetric: (metricName, metricValue, metricTags) => {
      emitMetric(metricName, metricValue, { request_id: requestId, ...(metricTags ?? {}) });
    },
    requestId,
  };

  try {
    const result = await handler(ctx);
    ctx.log({
      event: `${name}.success`,
      status: 'ok',
      details: { method: request.method, duration_ms: Date.now() - start },
    });
    return result;
  } catch (error) {
    ctx.log({
      event: `${name}.error`,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      details: { method: request.method, duration_ms: Date.now() - start },
    });
    throw error;
  }
}
