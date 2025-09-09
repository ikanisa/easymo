/**
 * API Constants for Production Admin Panel
 * Single source of truth for API configuration
 */

export const API_BASE = import.meta.env.VITE_API_BASE || '/functions/v1';

export const ADMIN_HEADERS = () => ({
  'Content-Type': 'application/json',
  'x-admin-token': getAdminToken(),
});

function getAdminToken(): string {
  return import.meta.env.VITE_ADMIN_TOKEN || 
         localStorage.getItem('admin_token') || 
         '';
}

export const SUPABASE_PROJECT_ID = 'ezrriefbmhiiqfoxgjgz';

// Deep links to Supabase Studio
export const SUPABASE_LINKS = {
  dashboard: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}`,
  tables: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/editor`,
  functions: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/functions`,
  storage: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/storage/buckets`,
  proofs: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/storage/buckets/proofs`,
  logs: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/logs/edge-functions`,
  auth: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/auth/users`,
  cron: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/functions`,
};