const ROUTER_LOG_DRAIN_URL = import.meta.env.VITE_ROUTER_LOG_DRAIN_URL;
const ROUTER_METRICS_DRAIN_URL = import.meta.env.VITE_ROUTER_METRICS_DRAIN_URL;
const ROUTER_LATENCY_SLO_MS = Number(import.meta.env.VITE_ROUTER_LATENCY_SLO_MS ?? '800');

let cachedTraceId: string | null = null;

function generateTraceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(16).slice(2);
}

function resolveTraceId(): string {
  if (cachedTraceId) return cachedTraceId;
  if (typeof window === 'undefined') {
    cachedTraceId = generateTraceId();
    return cachedTraceId;
  }
  const storageKey = 'easymo-router-trace-id';
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) {
    cachedTraceId = existing;
    return existing;
  }
  const next = generateTraceId();
  window.sessionStorage.setItem(storageKey, next);
  cachedTraceId = next;
  return next;
}

function sendBeacon(url: string, payload: unknown) {
  try {
    const json = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([json], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }
    void fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-observability-source': 'router',
      },
      body: json,
      keepalive: true,
    });
  } catch (error) {
    console.warn('router.log_drain.failed', error);
  }
}

function emit(level: 'info' | 'warn' | 'error', event: string, details: Record<string, unknown> = {}) {
  const traceId = resolveTraceId();
  const payload = {
    level,
    event,
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    ...details,
  };

  const consoleMethod: 'warn' | 'error' = level === 'error' ? 'error' : 'warn';
  console[consoleMethod]('observability', payload);

  if (ROUTER_LOG_DRAIN_URL) {
    sendBeacon(ROUTER_LOG_DRAIN_URL, { ...payload, kind: 'router_log' });
  }
}

function emitNavigationMetric(details: Record<string, unknown>) {
  if (!ROUTER_METRICS_DRAIN_URL) return;
  sendBeacon(ROUTER_METRICS_DRAIN_URL, {
    kind: 'router_metric',
    trace_id: resolveTraceId(),
    timestamp: new Date().toISOString(),
    slo: {
      latency_target_ms: ROUTER_LATENCY_SLO_MS,
    },
    ...details,
  });
}

export const browserLogger = {
  getTraceId: resolveTraceId,
  info(event: string, details: Record<string, unknown> = {}) {
    emit('info', event, details);
  },
  warn(event: string, details: Record<string, unknown> = {}) {
    emit('warn', event, details);
  },
  error(event: string, details: Record<string, unknown> = {}) {
    emit('error', event, details);
  },
  navigationStart(route: string, navigationType: string, spanId: string) {
    emit('info', 'router.navigation.start', { route, navigation_type: navigationType, span_id: spanId });
  },
  navigationComplete(route: string, navigationType: string, spanId: string, durationMs: number) {
    emit('info', 'router.navigation.complete', {
      route,
      navigation_type: navigationType,
      span_id: spanId,
      duration_ms: durationMs,
      slo_target_ms: ROUTER_LATENCY_SLO_MS,
      slo_violation: durationMs > ROUTER_LATENCY_SLO_MS,
    });
    emitNavigationMetric({
      metric: 'router.navigation.duration_ms',
      value: durationMs,
      route,
      navigation_type: navigationType,
      span_id: spanId,
      slo_target_ms: ROUTER_LATENCY_SLO_MS,
      slo_breached: durationMs > ROUTER_LATENCY_SLO_MS,
    });
  },
};

export const routerSloConfig = {
  latencyTargetMs: ROUTER_LATENCY_SLO_MS,
};
