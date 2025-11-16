const DEFAULT_CACHE_TTL_MS = (() => {
  const raw = safeEnvGet("SECRET_CACHE_TTL_MS");
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
})();

const DEFAULT_PREVIOUS_SUFFIX = "_PREVIOUS";

const SECRET_BINDING_PREFIXES = (() => {
  const raw = safeEnvGet("SECRET_BINDING_PREFIXES");
  if (!raw) {
    return ["SUPABASE_SECRET_", "SUPABASE_SECRETS_", "SB_SECRET_"];
  }
  return raw.split(",").map((value) => value.trim()).filter((value) => value.length > 0);
})();

type CacheEntry = {
  value: string | null;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function safeEnvGet(key: string): string | null {
  try {
    if (typeof Deno === "undefined" || !("env" in Deno)) return null;
    const value = Deno.env.get(key);
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (_error) {
    return null;
  }
}

function buildCacheKey(candidate: string): string {
  return candidate.toUpperCase();
}

function resolveCandidates(key: string): string[] {
  const normalized = key.trim();
  const variants = new Set<string>();
  variants.add(normalized);
  variants.add(normalized.toUpperCase());
  variants.add(normalized.toLowerCase());
  const candidates: string[] = [];
  for (const variant of variants) {
    candidates.push(variant);
    for (const prefix of SECRET_BINDING_PREFIXES) {
      candidates.push(`${prefix}${variant}`);
    }
  }
  return candidates;
}

function readSecretRaw(candidate: string): string | null {
  const cacheKey = buildCacheKey(candidate);
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const value = safeEnvGet(candidate);
  cache.set(cacheKey, {
    value,
    expiresAt: now + DEFAULT_CACHE_TTL_MS,
  });
  return value;
}

type SecretOptions = {
  fallbackKeys?: string[];
  allowEmpty?: boolean;
  refresh?: boolean;
};

export function clearSecretCache(key?: string): void {
  if (!key) {
    cache.clear();
    return;
  }
  const candidates = resolveCandidates(key);
  for (const candidate of candidates) {
    cache.delete(buildCacheKey(candidate));
  }
}

function tryLoadSecret(key: string, options: SecretOptions): string | null {
  const candidates = resolveCandidates(key);
  const allowEmpty = options.allowEmpty ?? false;
  for (const candidate of candidates) {
    if (options.refresh) {
      cache.delete(buildCacheKey(candidate));
    }
    const value = readSecretRaw(candidate);
    if (value === null) continue;
    if (!allowEmpty && value.trim().length === 0) continue;
    return value;
  }
  return null;
}

export function getSecret(key: string, options: SecretOptions = {}): string | null {
  const allKeys = [key, ...(options.fallbackKeys ?? [])];
  for (const candidate of allKeys) {
    const value = tryLoadSecret(candidate, options);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

export function requireSecret(key: string, options: SecretOptions = {}): string {
  const value = getSecret(key, options);
  if (value === null || (!options.allowEmpty && value.trim().length === 0)) {
    const candidates = [key, ...(options.fallbackKeys ?? [])].join("/");
    throw new Error(`Missing required secret: ${candidates}`);
  }
  return value;
}

type RotationOptions = SecretOptions & {
  previousSuffix?: string;
};

export function getSecretPair(
  key: string,
  options: RotationOptions = {},
): { active: string | null; previous: string | null } {
  const { previousSuffix = DEFAULT_PREVIOUS_SUFFIX, fallbackKeys = [] } = options;
  const active = getSecret(key, options);
  const previousFallbacks = fallbackKeys.map((fallback) => `${fallback}${previousSuffix}`);
  const previous = getSecret(`${key}${previousSuffix}`, {
    ...options,
    fallbackKeys: previousFallbacks,
  });
  return { active, previous };
}

export function getStringList(
  key: string,
  fallbackKeys: string[] = [],
  separator = ",",
): string[] {
  const raw = getSecret(key, { fallbackKeys, allowEmpty: true }) ?? "";
  if (!raw) return [];
  return raw.split(separator).map((value) => value.trim()).filter((value) => value.length > 0);
}

export function getBooleanSecret(
  key: string,
  fallbackKeys: string[] = [],
  defaultValue = false,
): boolean {
  const value = getSecret(key, { fallbackKeys, allowEmpty: true });
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

export function getNumberSecret(
  key: string,
  fallbackKeys: string[] = [],
  defaultValue: number,
): number {
  const value = getSecret(key, { fallbackKeys, allowEmpty: true });
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
