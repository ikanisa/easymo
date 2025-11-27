import { logger as simpleLogger } from './simple-logger';

interface LogContext {
  event: string;
  target?: string;
  actor?: string;
  entity?: string;
  status?: 'ok' | 'degraded' | 'error';
  message?: string;
  details?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  [key: string]: unknown;
}

export function logStructured(context: LogContext) {
  simpleLogger.info({
    target: 'admin-app',
    ...context,
  });
}

// Re-export logger for compatibility
export const logger = simpleLogger;
