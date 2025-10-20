let initialized = false;
let metricsUrl: string | null = null;

function ensureMetricsUrl() {
  if (initialized) return;
  metricsUrl = process.env.METRICS_DRAIN_URL ?? null;
  initialized = true;
}

export function emitMetric(name: string, value: number, tags?: Record<string, unknown>) {
  ensureMetricsUrl();
  if (!metricsUrl) return;
  const body = {
    name,
    value,
    tags: tags ?? {},
    ts: Date.now(),
  };
  try {
    void fetch(metricsUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {
      /* swallow */
    });
  } catch {
    // intentionally ignored to keep metrics fire-and-forget
  }
}

