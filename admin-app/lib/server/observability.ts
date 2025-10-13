import { logStructured } from "./logger";

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
    recordMetric: (_name, _value, _tags) => {
      // TODO: wire metrics emitter (e.g. StatsD/Prometheus exporter)
    },
  };

  try {
    const result = await handler(ctx);
    ctx.log({
      event: `${name}.success`,
      status: 'ok',
      tags: {
        method: request.method,
        duration_ms: Date.now() - start,
      },
    });
    return result;
  } catch (error) {
    ctx.log({
      event: `${name}.error`,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      tags: {
        method: request.method,
        duration_ms: Date.now() - start,
      },
    });
    throw error;
  }
}
