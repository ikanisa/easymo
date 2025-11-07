/**
 * Next.js instrumentation hook for server-side initialization and error tracking
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { captureException, captureMessage } = await import("@/lib/server/sentry");

    // Log startup
    console.log("[instrumentation] Server initialization complete", {
      nodeEnv: process.env.NODE_ENV,
      sentryEnabled: Boolean(process.env.SENTRY_DSN),
      timestamp: new Date().toISOString(),
    });

    // Capture unhandled rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("[instrumentation] Unhandled Rejection", {
        reason,
        promise,
        timestamp: new Date().toISOString(),
      });
      captureException(reason instanceof Error ? reason : new Error(String(reason)), {
        type: "unhandledRejection",
      });
    });

    // Capture uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("[instrumentation] Uncaught Exception", {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      captureException(error, {
        type: "uncaughtException",
      });
    });

    // Log if Sentry is not configured
    if (!process.env.SENTRY_DSN) {
      console.warn("[instrumentation] SENTRY_DSN not configured - server errors will not be tracked");
    }
  }

  // Edge runtime initialization
  if (process.env.NEXT_RUNTIME === "edge") {
    console.log("[instrumentation] Edge runtime initialization");
  }
}
