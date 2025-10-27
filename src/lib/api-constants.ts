/**
 * API Constants for Production Admin Panel
 * Single source of truth for API configuration
 */

import { getAdminToken, getApiBase, getSupabaseProjectId, getSupabaseUrl } from './env';

const DEFAULT_SUPABASE_URL = 'https://vacltfdslodqybxojytc.supabase.co';
const DEFAULT_PROJECT_ID = 'vacltfdslodqybxojytc';

const resolvedSupabaseUrl = getSupabaseUrl() ?? DEFAULT_SUPABASE_URL;
const resolvedProjectId = getSupabaseProjectId() ?? DEFAULT_PROJECT_ID;

export const API_BASE = getApiBase() || `${resolvedSupabaseUrl}/functions/v1`;

export const ADMIN_HEADERS = () => ({
  'Content-Type': 'application/json',
  'x-admin-token': getAdminToken(),
});

const SUPABASE_URL = resolvedSupabaseUrl;
export const SUPABASE_PROJECT_ID = resolvedProjectId;

const withProjectLink = (path: string): string | undefined =>
  SUPABASE_PROJECT_ID ? `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}${path}` : undefined;

// Deep links to Supabase Studio
export const SUPABASE_LINKS: Record<string, string | undefined> = {
  dashboard: withProjectLink(''),
  tables: withProjectLink('/editor'),
  functions: withProjectLink('/functions'),
  storage: withProjectLink('/storage/buckets'),
  proofs: withProjectLink('/storage/buckets/proofs'),
  logs: withProjectLink('/logs/edge-functions'),
  auth: withProjectLink('/auth/users'),
  cron: withProjectLink('/functions'),
};

export const HAS_SUPABASE_PROJECT = Boolean(SUPABASE_PROJECT_ID && SUPABASE_URL);
