import { env } from "../env.server";
import "server-only";

let initialized = false;

function shouldEnable(): boolean {
  return Boolean(env.sentry.serverDsn);
}

function initIfNeeded(S: any) {
  if (initialized) return;
  S.init({ dsn: env.sentry.serverDsn ?? undefined, tracesSampleRate: 0.1 });
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
