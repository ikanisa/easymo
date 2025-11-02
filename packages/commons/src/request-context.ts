import { createNamespace } from "cls-hooked";
import { randomUUID } from "crypto";

const REQUEST_NAMESPACE = "agent-core-request";

export type RequestContextShape = {
  requestId: string;
  traceId: string;
  spanId: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
};

type RequestContextSeed = Partial<RequestContextShape> | string | undefined;

const CONTEXT_KEY = "context";

type StoreShape = { [CONTEXT_KEY]?: RequestContextShape };

const ns = createNamespace<StoreShape>(REQUEST_NAMESPACE);

const normaliseSeed = (seed?: RequestContextSeed): RequestContextShape => {
  if (typeof seed === "string" && seed.trim().length > 0) {
    const id = seed.trim();
    return { requestId: id, traceId: id, spanId: randomUUID() };
  }

  const requestId =
    (typeof seed === "object" && seed?.requestId && seed.requestId.trim().length > 0
      ? seed.requestId.trim()
      : randomUUID());

  const traceId =
    typeof seed === "object" && seed?.traceId && seed.traceId.trim().length > 0
      ? seed.traceId.trim()
      : requestId;

  const spanId =
    typeof seed === "object" && seed?.spanId && seed.spanId.trim().length > 0
      ? seed.spanId.trim()
      : randomUUID();

  return {
    requestId,
    traceId,
    spanId,
    userId: typeof seed === "object" ? seed?.userId : undefined,
    sessionId: typeof seed === "object" ? seed?.sessionId : undefined,
    metadata: typeof seed === "object" ? seed?.metadata : undefined,
  };
};

export const withRequestContext = async <T>(
  fn: () => Promise<T> | T,
  seed?: RequestContextSeed,
): Promise<T> => {
  return await ns.runPromise(async () => {
    ns.set(CONTEXT_KEY, normaliseSeed(seed));
    return await fn();
  });
};

export const runWithRequestContext = <T>(fn: () => T, seed?: RequestContextSeed): T => {
  return ns.run(() => {
    ns.set(CONTEXT_KEY, normaliseSeed(seed));
    return fn();
  });
};

const getContext = (): RequestContextShape | undefined => ns.get(CONTEXT_KEY);

export const getRequestId = () => {
  return getContext()?.requestId;
};

export const setRequestId = (requestId: string) => {
  const ctx = getContext();
  if (!ctx) {
    ns.set(CONTEXT_KEY, normaliseSeed({ requestId }));
    return;
  }
  ns.set(CONTEXT_KEY, { ...ctx, requestId, traceId: ctx.traceId ?? requestId });
};

export const getTraceId = () => getContext()?.traceId ?? getContext()?.requestId;

export const setTraceId = (traceId: string) => {
  const ctx = getContext();
  if (!ctx) {
    ns.set(CONTEXT_KEY, normaliseSeed({ traceId }));
    return;
  }
  ns.set(CONTEXT_KEY, { ...ctx, traceId });
};

export const getSpanId = () => getContext()?.spanId;

export const setSpanId = (spanId: string) => {
  const ctx = getContext();
  if (!ctx) {
    ns.set(CONTEXT_KEY, normaliseSeed({ spanId }));
    return;
  }
  ns.set(CONTEXT_KEY, { ...ctx, spanId });
};

export const getRequestContext = () => getContext();
