import pino from "pino";
export declare const logger: pino.Logger<never, boolean>;
export declare const childLogger: (bindings: Record<string, unknown>) => pino.Logger<never, boolean>;
export declare const withTelemetryContext: <T>(fn: () => Promise<T> | T, seed?: {
    requestId?: string;
    traceId?: string;
    spanId?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
}) => Promise<T>;
export declare const attachTraceToLogger: (traceId: string) => void;
export declare const attachRequestToLogger: (requestId: string) => void;
export declare const attachSpanToLogger: (spanId: string) => void;
interface ConsoleWrapper {
    log: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}
/**
 * Create a console-compatible logger (for migration purposes)
 * Use childLogger() for new code instead
 */
export declare function createServiceConsole(serviceName: string): ConsoleWrapper;
export {};
//# sourceMappingURL=logger.d.ts.map