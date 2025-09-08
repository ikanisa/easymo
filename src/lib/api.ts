/**
 * Production API Client for Admin Panel
 * Calls Edge Function endpoints with proper authentication
 */

import { API_BASE, ADMIN_HEADERS } from './api-constants';
import type { 
  Settings, 
  AdminStats, 
  User, 
  Trip, 
  Subscription 
} from './types';

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { 
    headers: ADMIN_HEADERS() 
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
  
  return response.json();
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: ADMIN_HEADERS(),
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
  
  return response.json();
}

export const AdminAPI = {
  // Settings / Flags
  getSettings: (): Promise<Settings & { pro_enabled: boolean }> => 
    apiGet('/admin-settings'),
    
  saveSettings: (patch: Partial<Settings & { pro_enabled: boolean }>): Promise<Settings & { pro_enabled: boolean }> => 
    apiPost('/admin-settings', patch),

  // Operations metrics
  getStats: (): Promise<AdminStats> => 
    apiGet('/admin-stats'),

  // Data views
  getUsers: (): Promise<User[]> => 
    apiGet('/admin-users'),
    
  listTrips: (): Promise<Trip[]> => 
    apiGet('/admin-trips?action=list'),
    
  closeTrip: (id: number): Promise<void> => 
    apiPost('/admin-trips?action=close', { id }),

  // Monetization
  listSubs: (): Promise<Subscription[]> => 
    apiGet('/admin-subscriptions?action=list'),
    
  approveSub: (id: number, txn_id?: string): Promise<void> =>
    apiPost('/admin-subscriptions?action=approve', { id, txn_id }),
    
  rejectSub: (id: number, reason?: string): Promise<void> =>
    apiPost('/admin-subscriptions?action=reject', { id, reason }),

  // Storage ingestion
  mediaFetch: (media_id: string, subscription_id: number): Promise<{ signed_url: string }> =>
    apiPost('/media-fetch', { media_id, subscription_id }),

  // Health check
  healthCheck: (): Promise<{ status: 'ok', timestamp: string, round_trip_ms: number }> => {
    const start = Date.now();
    return apiGet('/admin-stats').then(data => ({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      round_trip_ms: Date.now() - start
    }));
  }
};

// Error handling utilities
export class APIError extends Error {
  constructor(
    message: string, 
    public status?: number, 
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function isUnauthorized(error: any): boolean {
  return error?.message?.includes('401') || error?.message?.includes('403');
}