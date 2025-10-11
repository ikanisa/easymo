"use client";

let initialized = false;

function shouldEnable(): boolean {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return Boolean(dsn && dsn.trim().length > 0);
}

function initIfNeeded(S: any) {
  if (initialized) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  S.init({ dsn, tracesSampleRate: 0.1 });
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!shouldEnable()) return;
  // Dynamic import so tests and builds without Sentry remain unaffected
  const moduleName = '@sentry' + '/nextjs';
  // @vite-ignore
  import(moduleName).then((S) => {
    initIfNeeded(S);
    try {
      S.captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: context ?? {},
      });
    } catch {
      // swallow
    }
  }).catch(() => {});
}
