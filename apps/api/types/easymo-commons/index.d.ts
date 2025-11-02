declare module '@easymo/commons' {
  export interface TelemetrySeed {
    requestId?: string;
    traceId?: string;
    spanId?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }

  export interface SharedLogger {
    debug(payload: Record<string, unknown>): void;
    info(payload: Record<string, unknown>): void;
    warn(payload: Record<string, unknown>): void;
    error(payload: Record<string, unknown>): void;
    child(bindings: Record<string, unknown>): SharedLogger;
  }

  export const logger: SharedLogger;
  export function childLogger(bindings: Record<string, unknown>): SharedLogger;
  export function withTelemetryContext<T>(fn: () => Promise<T> | T, seed?: TelemetrySeed): Promise<T>;
  export function attachTraceToLogger(traceId: string): void;
  export function attachRequestToLogger(requestId: string): void;
  export function attachSpanToLogger(spanId: string): void;

  export function getApiControllerBasePath(controller: string): string;
  export function getApiEndpointSegment(controller: string, endpoint: string): string;
  export function getApiEndpointPath(controller: string, endpoint?: string): string;
  export function getApiEndpointMethod(controller: string, endpoint: string): string;

  export type ApiControllerKey = string;
  export type ApiEndpointKey = string;
  export type ApiRoutes = Record<string, unknown>;
  export const apiRoutes: ApiRoutes;
}
