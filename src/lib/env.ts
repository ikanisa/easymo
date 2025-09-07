/**
 * Environment configuration for ULTRA-MINIMAL WhatsApp Mobility
 * Single source of truth for environment variables
 */

export function isDev(): boolean {
  return import.meta.env.DEV;
}

export function useMock(): boolean {
  return import.meta.env.VITE_USE_MOCK !== 'false';
}

export function showDevTools(): boolean {
  return import.meta.env.VITE_DEV_TOOLS === '1';
}

export function getAdminToken(): string {
  return import.meta.env.VITE_ADMIN_TOKEN || 'demo-token';
}

export function getApiBase(): string {
  return import.meta.env.VITE_API_BASE || '/functions/v1';
}