let sentryImportFn: (() => Promise<any>) | null = null;
let sentryPromise: Promise<any | null> | null = null;

function createImporter(): () => Promise<any> {
  if (!sentryImportFn) {
    sentryImportFn = Function("return import('@sentry/nextjs')") as () => Promise<any>;
  }
  return sentryImportFn;
}

/**
 * Lazily loads the Sentry SDK. When the package is not installed the promise
 * resolves to `null` so callers can silently continue without instrumentation.
 */
export async function loadSentryModule(): Promise<any | null> {
  if (!sentryPromise) {
    const importer = createImporter();
    sentryPromise = importer()
      .then((mod) => mod)
      .catch(() => {
        // Reset so we can retry on subsequent calls.
        sentryPromise = null;
        return null;
      });
  }
  return sentryPromise;
}
