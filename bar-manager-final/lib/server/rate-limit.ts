type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();
const WINDOW_SECONDS = 900; // 15 minutes
const MAX_ATTEMPTS = 5;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export function clearRateLimit(key: string) {
  store.delete(key);
}

export function getRateLimit(key: string) {
  const entry = store.get(key);
  if (!entry) return { remaining: MAX_ATTEMPTS, resetIn: WINDOW_SECONDS, limited: false } as const;
  const remaining = Math.max(0, MAX_ATTEMPTS - entry.count);
  const resetIn = Math.max(0, entry.resetAt - nowSec());
  return { remaining, resetIn, limited: remaining === 0 } as const;
}

export function recordFailure(key: string) {
  const current = store.get(key);
  const ts = nowSec();
  if (!current || current.resetAt <= ts) {
    store.set(key, { count: 1, resetAt: ts + WINDOW_SECONDS });
  } else {
    current.count += 1;
    store.set(key, current);
  }
  return getRateLimit(key);
}

