import { logger } from '@easymo/commons';

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
  logger.info({
    target: 'admin-app',
    ...context,
  });
}
