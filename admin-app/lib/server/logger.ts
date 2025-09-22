'use server';

interface LogContext {
  event: string;
  target?: string;
  actor?: string;
  entity?: string;
  status?: 'ok' | 'degraded' | 'error';
  message?: string;
  details?: Record<string, unknown>;
}

export function logStructured(context: LogContext) {
  const payload = {
    timestamp: new Date().toISOString(),
    ...context
  };
  console.log(JSON.stringify(payload));
}

