/**
 * Centralised runtime configuration with feature-flag aware helpers.
 *
 * These helpers intentionally proxy through to the existing environment
 * variables that power the legacy applications. New modules can import from
 * this package and participate in the strangler migration without waiting for
 * bespoke plumbing.
 */

type EnvRecord = Record<string, string | undefined>;

type MaybeEnv = EnvRecord | undefined;

const toEnvRecord = (candidate: unknown): MaybeEnv => {
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  return candidate as EnvRecord;
};

const readImportMetaEnv = (): MaybeEnv => {
  if (typeof import.meta === 'undefined') {
    return undefined;
  }

  const meta = import.meta as ImportMeta & { env?: unknown };
  return toEnvRecord(meta.env);
};

const readEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env && key in process.env) {
    const value = process.env[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  const metaEnv = readImportMetaEnv();
  const metaValue = metaEnv?.[key];
  return typeof metaValue === 'string' ? metaValue : undefined;
};

const truthyValues = new Set(['1', 'true', 'yes', 'on']);
const falsyValues = new Set(['0', 'false', 'no', 'off']);

const readBooleanFlag = (...keys: string[]): boolean => {
  for (const key of keys) {
    const raw = readEnv(key);
    if (typeof raw !== 'string') {
      continue;
    }

    const normalised = raw.trim().toLowerCase();
    if (truthyValues.has(normalised)) {
      return true;
    }

    if (falsyValues.has(normalised)) {
      return false;
    }
  }

  return false;
};

const readString = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = readEnv(key)?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
};

export type FeatureFlagConfig = {
  adminPwa: boolean;
  modularApis: boolean;
  routerFunctions: boolean;
  agentChat: boolean;
};

export const featureFlags: FeatureFlagConfig = {
  adminPwa: readBooleanFlag('VITE_ENABLE_ADMIN_PWA', 'ENABLE_ADMIN_PWA'),
  modularApis: readBooleanFlag('VITE_ENABLE_APP_APIS', 'ENABLE_APP_APIS'),
  routerFunctions: readBooleanFlag('VITE_ENABLE_ROUTER_FN', 'ENABLE_ROUTER_FN'),
  agentChat: readBooleanFlag('VITE_ENABLE_AGENT_CHAT', 'ENABLE_AGENT_CHAT')
};

export type RuntimeConfig = {
  apiBaseUrl: string | undefined;
  adminToken: string | undefined;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
};

export const runtimeConfig: RuntimeConfig = {
  apiBaseUrl: readString('API_BASE_URL', 'VITE_API_BASE'),
  adminToken: readString('ADMIN_TOKEN', 'VITE_ADMIN_TOKEN'),
  supabaseUrl: readString('SUPABASE_URL', 'VITE_SUPABASE_URL'),
  supabaseAnonKey: readString('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
};

export const config = {
  featureFlags,
  runtime: runtimeConfig
};

export type Config = typeof config;
