import { z } from 'zod';

type RawEnv = {
  MODE?: string;
  DEV?: boolean;
  PROD?: boolean;
  VITE_USE_MOCK?: string;
  VITE_DEV_TOOLS?: string;
  VITE_ENABLE_AGENT_CHAT?: string;
  VITE_ADMIN_TOKEN?: string;
  VITE_API_BASE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PROJECT_ID?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_SERVICE_KEY?: string;
  VITE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_MOBILITY_USER_ID?: string;
  VITE_MOBILITY_USER_ROLES?: string;
};

const rawEnvSchema = z
  .object({
    MODE: z.string().optional(),
    VITE_USE_MOCK: z.string().optional(),
    VITE_DEV_TOOLS: z.string().optional(),
    VITE_ENABLE_AGENT_CHAT: z.string().optional(),
    VITE_ADMIN_TOKEN: z.string().optional(),
    VITE_API_BASE: z.string().optional(),
    VITE_SUPABASE_URL: z.string().optional(),
    VITE_SUPABASE_PROJECT_ID: z.string().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().optional(),
    VITE_SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    VITE_SUPABASE_SERVICE_KEY: z.string().optional(),
    VITE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
    VITE_MOBILITY_USER_ID: z.string().optional(),
    VITE_MOBILITY_USER_ROLES: z.string().optional(),
  })
  .passthrough();

type ParsedEnv = RawEnv & {
  VITE_API_BASE?: string;
};

const parsed = rawEnvSchema.parse(import.meta.env as RawEnv) as ParsedEnv;

const toBoolean = (value: string | undefined, fallback = false): boolean => {
  if (typeof value !== 'string') return fallback;
  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false;
    default:
      return fallback;
  }
};

const mode = parsed.MODE ?? (typeof process !== 'undefined' ? process.env.NODE_ENV : undefined);
const isTestMode = mode === 'test';
const useMocks = toBoolean(parsed.VITE_USE_MOCK, false);

if (!useMocks && !isTestMode) {
  if (!parsed.VITE_SUPABASE_URL) {
    throw new Error('VITE_SUPABASE_URL is required when VITE_USE_MOCK is not enabled.');
  }
  if (!parsed.VITE_SUPABASE_ANON_KEY) {
    throw new Error('VITE_SUPABASE_ANON_KEY is required when VITE_USE_MOCK is not enabled.');
  }
}

export const env = {
  ...parsed,
  MODE: mode,
  VITE_API_BASE: parsed.VITE_API_BASE ?? '/functions/v1',
  flags: {
    useMocks,
    devTools: toBoolean(parsed.VITE_DEV_TOOLS, false),
    agentChat: toBoolean(parsed.VITE_ENABLE_AGENT_CHAT, false),
  },
};

export type Env = typeof env;

export const envBoolean = toBoolean;
