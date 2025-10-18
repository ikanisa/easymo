"use server";

let initialized = false;

function shouldEnable(): boolean {
  const dsn = process.env.SENTRY_DSN;
  return Boolean(dsn && dsn.trim().length > 0);
}

function initIfNeeded(S: any) {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  S.init({ dsn, tracesSampleRate: 0.1 });
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!shouldEnable()) return;
  const moduleName = '@sentry' + '/nextjs';
  void (async () => {
    try {
      // @vite-ignore
      const S = await import(moduleName);
      initIfNeeded(S);
      S.captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: context ?? {},
      });
    } catch {
      // swallow
    }
  })();
}

export function captureMessage(message: string, context?: Record<string, unknown>) {
  if (!shouldEnable()) return;
  const moduleName = '@sentry' + '/nextjs';
  void (async () => {
    try {
      // @vite-ignore
      const S = await import(moduleName);
      initIfNeeded(S);
      S.captureMessage(message, { extra: context ?? {} });
    } catch {
      // swallow
    }
  })();
}
