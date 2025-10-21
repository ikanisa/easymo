import { env } from '../env';

/**
 * Environment configuration for ULTRA-MINIMAL WhatsApp Mobility
 * Single source of truth for environment variables
 */

export function isDev(): boolean {
  return Boolean(env.DEV ?? env.MODE === 'development');
}

export function shouldUseMock(): boolean {
  return env.flags.useMocks;
}

export function showDevTools(): boolean {
  return env.flags.devTools;
}

export function isAgentChatEnabled(): boolean {
  return env.flags.agentChat;
}

export function getAdminToken(): string {
  if (env.VITE_ADMIN_TOKEN) {
    return env.VITE_ADMIN_TOKEN;
  }

  if (typeof window !== 'undefined') {
    const storedToken = window.localStorage.getItem('admin_token');
    if (storedToken) {
      return storedToken;
    }
  }

  return 'demo-token';
}

export function getApiBase(): string {
  return env.VITE_API_BASE;
}

export function getSupabaseUrl(): string | undefined {
  const url = env.VITE_SUPABASE_URL?.trim();
  return url ? url : undefined;
}

export function getSupabaseProjectId(): string | undefined {
  const explicit = env.VITE_SUPABASE_PROJECT_ID?.trim();
  if (explicit) {
    return explicit;
  }

  const url = getSupabaseUrl();
  if (url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.split('.')[0];
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  const key = env.VITE_SUPABASE_ANON_KEY?.trim()
    || env.SUPABASE_ANON_KEY?.trim();
  return key ? key : undefined;
}

export function getSupabaseServiceRoleKey(): string | undefined {
  const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim()
    || env.VITE_SUPABASE_SERVICE_KEY?.trim()
    || env.VITE_SERVICE_ROLE_KEY?.trim()
    || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return key ? key : undefined;
}

export function getMobilityUserId(): string {
  return (
    env.VITE_MOBILITY_USER_ID
      ?? '00000000-0000-4000-8000-000000000001'
  ).toString();
}

export function getMobilityUserRoles(): string {
  return (
    env.VITE_MOBILITY_USER_ROLES
      ?? 'admin'
  ).toString();
}
