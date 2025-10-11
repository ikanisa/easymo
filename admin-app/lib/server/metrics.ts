let inited = false;
let url: string | null = null;

function ensureInit() {
  if (inited) return;
  url = process.env.METRICS_DRAIN_URL ?? null;
  inited = true;
}

export function emitMetric(name: string, value: number, tags?: Record<string, unknown>) {
  ensureInit();
  if (!url) return;
  try {
    const body = {
      name,
      value,
      tags: tags ?? {},
      ts: Date.now(),
    };
    // fire-and-forget
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // swallow
  }
}

