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
