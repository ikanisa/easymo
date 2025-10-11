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
  // Fire-and-forget dynamic import to avoid hard dependency
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
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

export function captureMessage(message: string, context?: Record<string, unknown>) {
  if (!shouldEnable()) return;
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  const moduleName = '@sentry' + '/nextjs';
  // @vite-ignore
  import(moduleName).then((S) => {
    initIfNeeded(S);
    try {
      S.captureMessage(message, { extra: context ?? {} });
    } catch {
      // swallow
    }
  }).catch(() => {});
}
