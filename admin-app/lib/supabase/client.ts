// Re-export from supabase-client for compatibility
import { getSupabaseClient } from '../supabase-client'

export function createClient() {
  return getSupabaseClient()
}
