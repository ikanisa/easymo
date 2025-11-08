/**
 * Next.js instrumentation hook for server-side initialization and error tracking
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Log startup
    console.log("[instrumentation] Server initialization complete", {
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });

    // Basic error logging without Sentry
    process.on("unhandledRejection", (reason, promise) => {
      console.error("[instrumentation] Unhandled Rejection", {
        reason,
        promise,
        timestamp: new Date().toISOString(),
      });
    });

    process.on("uncaughtException", (error) => {
      console.error("[instrumentation] Uncaught Exception", {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    });
  }

  // Edge runtime initialization
  if (process.env.NEXT_RUNTIME === "edge") {
    console.log("[instrumentation] Edge runtime initialization");
  }
}
