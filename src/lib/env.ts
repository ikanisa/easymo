/**
 * Environment configuration for ULTRA-MINIMAL WhatsApp Mobility
 * Single source of truth for environment variables
 */

export function isDev(): boolean {
  return import.meta.env.DEV;
}

export function shouldUseMock(): boolean {
  return import.meta.env.VITE_USE_MOCK === '1' || import.meta.env.VITE_USE_MOCK === 'true';
}

export function showDevTools(): boolean {
  return import.meta.env.VITE_DEV_TOOLS === '1';
}

export function isAgentChatEnabled(): boolean {
  const raw = (import.meta.env.VITE_ENABLE_AGENT_CHAT ?? 'false').toString().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function getAdminToken(): string {
  if (import.meta.env.VITE_ADMIN_TOKEN) {
    return import.meta.env.VITE_ADMIN_TOKEN;
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
  return import.meta.env.VITE_API_BASE || '/functions/v1';
}

export function getSupabaseUrl(): string | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  return url ? url : undefined;
}

export function getSupabaseProjectId(): string | undefined {
  const explicit = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim();
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
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
    || import.meta.env.SUPABASE_ANON_KEY?.trim();
  return key ? key : undefined;
}

export function getMobilityUserId(): string {
  return (
    import.meta.env.VITE_MOBILITY_USER_ID
      ?? '00000000-0000-4000-8000-000000000001'
  ).toString();
}

export function getMobilityUserRoles(): string {
  return (
    import.meta.env.VITE_MOBILITY_USER_ROLES
      ?? 'admin'
  ).toString();
}

export function getOpenAiVectorStoreId(): string | undefined {
  const raw = import.meta.env.VITE_OPENAI_VECTOR_STORE_ID?.toString().trim();
  return raw && raw.length > 0 ? raw : undefined;
}
