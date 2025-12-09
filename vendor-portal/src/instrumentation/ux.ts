import { logInfo } from "@/lib/observability/logger";

type TimerHandle = {
  id: string;
  startedAt: number;
  context?: Record<string, unknown>;
};

const activeTimers = new Map<string, TimerHandle>();

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function resolveKey(id: string, scope?: string) {
  return scope ? `${scope}:${id}` : id;
}

export function startTimeToFirstResult(metricId: string, context?: Record<string, unknown>) {
  const key = resolveKey(metricId, "ttfr");
  if (activeTimers.has(key)) {
    return key;
  }
  activeTimers.set(key, { id: metricId, startedAt: now(), context });
  return key;
}

export function markTimeToFirstResult(metricId: string, extra?: Record<string, unknown>) {
  const key = resolveKey(metricId, "ttfr");
  const handle = activeTimers.get(key);
  if (!handle) return;
  const duration = Math.max(0, Math.round(now() - handle.startedAt));
  logInfo("ux.time_to_first_result", {
    metricId: handle.id,
    durationMs: duration,
    ...(handle.context ?? {}),
    ...(extra ?? {}),
  });
  activeTimers.delete(key);
}

export function startFilterLatency(filterId: string, context?: Record<string, unknown>) {
  const key = resolveKey(filterId, "filter");
  activeTimers.set(key, { id: filterId, startedAt: now(), context });
  return key;
}

export function markFilterLatency(filterId: string, extra?: Record<string, unknown>) {
  const key = resolveKey(filterId, "filter");
  const handle = activeTimers.get(key);
  if (!handle) return;
  const duration = Math.max(0, Math.round(now() - handle.startedAt));
  logInfo("ux.filter_latency", {
    filterId: handle.id,
    durationMs: duration,
    ...(handle.context ?? {}),
    ...(extra ?? {}),
  });
  activeTimers.delete(key);
}

export function trackTaskFunnel(event: string, properties?: Record<string, unknown>) {
  logInfo("ux.task_funnel", {
    event,
    ...(properties ?? {}),
  });
}

export function trackCommandPalette(event: string, properties?: Record<string, unknown>) {
  logInfo("ux.command_palette", {
    event,
    ...(properties ?? {}),
  });
}

export function trackQueuedSyncSummary(summary: Record<string, unknown>) {
  logInfo("ux.offline_queue.summary", summary);
}

export function trackConflictResolution(event: string, properties?: Record<string, unknown>) {
  logInfo("ux.offline_conflict", {
    event,
    ...(properties ?? {}),
  });
}
