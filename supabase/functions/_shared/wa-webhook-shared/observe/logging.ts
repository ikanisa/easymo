import { logStructuredEvent } from "./log.ts";

export async function logUnhandled(type: unknown) {
  await logStructuredEvent("ROUTER_UNHANDLED", { type });
}

export async function logRpcNotImplemented(name: string) {
  await logStructuredEvent("RPC_NOT_IMPLEMENTED", { name });
}

export async function logMetric(
  name: string,
  value: number,
  dimensions?: Record<string, unknown>,
) {
  await logStructuredEvent("METRIC_EVENT", {
    name,
    value,
    dimensions: dimensions ?? {},
  });
}
