/**
 * Next.js instrumentation hook for server-side initialization and error tracking
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

const GLOBAL_STATE_KEY = Symbol.for("admin-app.instrumentation");

type SupportedRuntime = "nodejs" | "edge" | "unknown";

type InstrumentationState = {
  registeredRuntimes: Record<SupportedRuntime, boolean>;
};

function getGlobalState(): InstrumentationState {
  const globalScope = globalThis as Record<string | symbol, unknown>;
  const existingState = globalScope[GLOBAL_STATE_KEY];

  if (existingState && typeof existingState === "object") {
    return existingState as InstrumentationState;
  }

  const newState: InstrumentationState = {
    registeredRuntimes: {
      nodejs: false,
      edge: false,
      unknown: false,
    },
  };
  globalScope[GLOBAL_STATE_KEY] = newState;
  return newState;
}

function getRuntime(): SupportedRuntime {
  if (typeof process !== "undefined" && process?.env?.NEXT_RUNTIME) {
    return process.env.NEXT_RUNTIME as SupportedRuntime;
  }

  if (typeof globalThis !== "undefined" && "EdgeRuntime" in globalThis) {
    return "edge";
  }

  return "unknown";
}

function safeLog(message: string, context?: Record<string, unknown>) {
  if (typeof console !== "undefined" && typeof console.log === "function") {
    if (context) {
      console.log(`[instrumentation] ${message}`, context);
    } else {
      console.log(`[instrumentation] ${message}`);
    }
  }
}

function safeError(message: string, context: Record<string, unknown>) {
  if (typeof console !== "undefined" && typeof console.error === "function") {
    console.error(`[instrumentation] ${message}`, context);
  }
}

function registerNodeRuntimeHandlers(timestamp: string) {
  if (typeof process === "undefined" || typeof process.on !== "function") {
    return;
  }

  safeLog("Server initialization complete", {
    nodeEnv: process.env?.NODE_ENV,
    timestamp,
  });

  process.on("unhandledRejection", (reason, promise) => {
    safeError("Unhandled Rejection", {
      reason,
      promise,
      timestamp: new Date().toISOString(),
    });
  });

  process.on("uncaughtException", (error: Error) => {
    safeError("Uncaught Exception", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  });
}

function registerEdgeRuntimeHandlers(timestamp: string) {
  safeLog("Edge runtime initialization", { timestamp });
}

export async function register() {
  const state = getGlobalState();
  const runtime = getRuntime();

  if (state.registeredRuntimes[runtime]) {
    return;
  }

  state.registeredRuntimes[runtime] = true;

  const timestamp = new Date().toISOString();

  if (runtime === "nodejs") {
    registerNodeRuntimeHandlers(timestamp);
    return;
  }

  if (runtime === "edge") {
    registerEdgeRuntimeHandlers(timestamp);
    return;
  }

  safeLog("Unknown runtime initialization", { runtime, timestamp });
}
