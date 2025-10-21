import { env } from "../env.server";

let inited = false;
let url: string | null = null;

function ensureInit() {
  if (inited) return;
  url = env.logging.metricsUrl;
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
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // swallow
  }
}
