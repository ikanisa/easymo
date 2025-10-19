import { createNamespace } from "cls-hooked";
import { randomUUID } from "crypto";

const REQUEST_NAMESPACE = "agent-core-request";

type ContextShape = {
  requestId: string;
};

const ns = createNamespace<ContextShape>(REQUEST_NAMESPACE);

export const withRequestContext = <T>(
  fn: () => Promise<T> | T,
  seed?: Partial<ContextShape>,
) => {
  return ns.runPromise(async () => {
    ns.set("requestId", seed?.requestId ?? randomUUID());
    return await fn();
  });
};

export const runWithRequestContext = <T>(
  fn: () => T,
  seed?: Partial<ContextShape>,
) => {
  return ns.run(() => {
    ns.set("requestId", seed?.requestId ?? randomUUID());
    return fn();
  });
};

export const getRequestId = () => {
  return ns.get("requestId");
};

export const setRequestId = (requestId: string) => {
  ns.set("requestId", requestId);
};
