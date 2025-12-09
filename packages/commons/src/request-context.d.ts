export type RequestContextShape = {
    requestId: string;
    traceId: string;
    spanId: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
};
type RequestContextSeed = Partial<RequestContextShape> | string | undefined;
export declare const withRequestContext: <T>(fn: () => Promise<T> | T, seed?: RequestContextSeed) => Promise<T>;
export declare const runWithRequestContext: <T>(fn: () => T, seed?: RequestContextSeed) => T;
export declare const getRequestId: () => string | undefined;
export declare const setRequestId: (requestId: string) => void;
export declare const getTraceId: () => string | undefined;
export declare const setTraceId: (traceId: string) => void;
export declare const getSpanId: () => string | undefined;
export declare const setSpanId: (spanId: string) => void;
export declare const getRequestContext: () => RequestContextShape | undefined;
export {};
//# sourceMappingURL=request-context.d.ts.map