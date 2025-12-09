import { AsyncLocalStorage } from "node:async_hooks";
import { getRuntimeConfig } from "../../src/lib/runtime-config";

type MaybePromise<T> = T | Promise<T>;

type AsyncStorageAdapter<T> = {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => MaybePromise<R>): MaybePromise<R>;
  enterWith(store: T): void;
};
interface LogContext {
  requestId?: string;
  userId?: string | null;
  saccoId?: string | null;
  source?: string | null;
}

type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown> | undefined;

interface LogDrainConfig {
  endpoint: string;
  token: string | null;
  source: string | null;
  timeoutMs: number;
}

interface LogDrainAlertConfig {
  webhook: string;
  token: string | null;
  cooldownMs: number;
}

const storage = createAsyncStorage<LogContext>();

function createAsyncStorage<T>(): AsyncStorageAdapter<T> {
  if (typeof window === "undefined") {
    const asyncStorage = new AsyncLocalStorage<T>();
    return {
      getStore: () => asyncStorage.getStore(),
      run: (store, callback) => asyncStorage.run(store, callback),
      enterWith: (store) => asyncStorage.enterWith(store),
    };
  }
  return createClientStorage<T>();
}

function createClientStorage<T>(): AsyncStorageAdapter<T> {
  let current: T | undefined;

  return {
    getStore: () => current,
    run<R>(store: T, callback: () => MaybePromise<R>): MaybePromise<R> {
      const previous = current;
      current = store;
      try {
        const result = callback();
        if (isPromise(result)) {
          return result.finally(() => {
            current = previous;
          }) as MaybePromise<R>;
        }
        current = previous;
        return result;
      } catch (error) {
        current = previous;
        throw error;
      }
    },
    enterWith(store: T) {
      current = store;
    },
  };
}

function isPromise<T>(value: MaybePromise<T>): value is Promise<T> {
  return (
    typeof value === "object" && value !== null && typeof (value as Promise<T>).then === "function"
  );
}
const DEFAULT_ALERT_COOLDOWN_MS = 5 * 60 * 1000;
let lastLogDrainAlertAt: number | null = null;

function getEnvironmentLabel(): string {
  try {
    return getRuntimeConfig().environment;
  } catch {
    return process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
  }
}

function normalize(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).reduce<
      Record<string, unknown>
    >((accumulator, [key, item]) => {
      accumulator[key] = normalize(item);
      return accumulator;
    }, {});
    return entries;
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  return value;
}

function write(level: LogLevel, event: string, payload: LogPayload) {
  const context = storage.getStore() ?? {};
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    requestId: context.requestId ?? null,
    userId: context.userId ?? null,
    saccoId: context.saccoId ?? null,
    source: context.source ?? null,
    environment: getEnvironmentLabel(),
    payload: payload ? normalize(payload) : undefined,
  };

  const serialized = JSON.stringify(entry);

  switch (level) {
    case "warn":
      // eslint-disable-next-line no-console
      console.warn(serialized);
      break;
    case "error":
      // eslint-disable-next-line no-console
      console.error(serialized);
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(serialized);
  }
  const config = getLogDrainConfig();
  if (config && typeof fetch === "function") {
    queueMicrotask(() => {
      void forwardToDrain(entry, config);
    });
  }
}

function getLogDrainConfig(): LogDrainConfig | null {
  // Never forward logs from the browser; keep drain server-side only.
  if (typeof window !== "undefined") {
    return null;
  }
  const endpoint = process.env.LOG_DRAIN_URL ?? "";
  if (!endpoint) {
    return null;
  }

  const timeoutRaw = process.env.LOG_DRAIN_TIMEOUT_MS;
  const timeoutMs = Number.parseInt(timeoutRaw ?? "2000", 10);

  return {
    endpoint,
    token: process.env.LOG_DRAIN_TOKEN ?? null,
    source: process.env.LOG_DRAIN_SOURCE ?? null,
    timeoutMs: Number.isNaN(timeoutMs) ? 2000 : Math.max(timeoutMs, 250),
  } satisfies LogDrainConfig;
}

function getLogDrainAlertConfig(): LogDrainAlertConfig | null {
  const webhook = process.env.LOG_DRAIN_ALERT_WEBHOOK ?? "";
  if (!webhook) {
    return null;
  }

  const rawCooldown = process.env.LOG_DRAIN_ALERT_COOLDOWN_MS;
  const parsedCooldown = Number.parseInt(rawCooldown ?? "", 10);
  const cooldownMs = Number.isNaN(parsedCooldown)
    ? DEFAULT_ALERT_COOLDOWN_MS
    : Math.max(parsedCooldown, 1000);

  return {
    webhook,
    token: process.env.LOG_DRAIN_ALERT_TOKEN ?? null,
    cooldownMs,
  } satisfies LogDrainAlertConfig;
}

async function sendLogDrainAlert(entry: Record<string, unknown>, reason: unknown) {
  if (typeof fetch !== "function") {
    return;
  }

  const config = getLogDrainAlertConfig();
  if (!config) {
    return;
  }

  const now = Date.now();
  if (lastLogDrainAlertAt && now - lastLogDrainAlertAt < config.cooldownMs) {
    return;
  }

  lastLogDrainAlertAt = now;

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  const payload = {
    event: "log_drain_failure",
    timestamp: new Date(now).toISOString(),
    reason: reason instanceof Error ? reason.message : String(reason),
    entry,
  } satisfies Record<string, unknown>;

  try {
    await fetch(config.webhook, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    if (process.env.LOG_DRAIN_SILENT !== "1") {
      // eslint-disable-next-line no-console
      console.warn("[log-drain] alert forward failed", error);
    }
  }
}

async function forwardToDrain(entry: Record<string, unknown>, config: LogDrainConfig) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), config.timeoutMs) : null;

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (config.token) {
      headers.Authorization = `Bearer ${config.token}`;
    }

    const payload = {
      ...entry,
      forwarderSource: config.source ?? null,
    };

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!response.ok) {
      if (process.env.LOG_DRAIN_SILENT !== "1") {
        // eslint-disable-next-line no-console
        console.warn(
          "[log-drain] forward failed",
          new Error(`unexpected status ${response.status}`)
        );
      }

      queueMicrotask(() => {
        void sendLogDrainAlert(entry, new Error(`unexpected status ${response.status}`));
      });
    }
  } catch (error) {
    if (process.env.LOG_DRAIN_SILENT !== "1") {
      // eslint-disable-next-line no-console
      console.warn("[log-drain] forward failed", error);
    }
    queueMicrotask(() => {
      void sendLogDrainAlert(entry, error);
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function withLogContext<T>(
  base: LogContext,
  callback: () => Promise<T> | T
): Promise<T> | T {
  const parent = storage.getStore() ?? {};
  const merged = { ...parent, ...base };
  return storage.run(merged, callback);
}

export function updateLogContext(context: Partial<LogContext>) {
  const store = storage.getStore();
  if (store) {
    Object.assign(store, context);
  } else {
    storage.enterWith({ ...context });
  }
}

export function getCurrentLogContext(): LogContext {
  return storage.getStore() ?? {};
}

export function logInfo(event: string, payload?: Record<string, unknown>) {
  write("info", event, payload);
}

export function logWarn(event: string, payload?: Record<string, unknown>) {
  write("warn", event, payload);
}

export function logError(event: string, payload?: Record<string, unknown>) {
  write("error", event, payload);
}
