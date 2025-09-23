import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export type SupabaseClient = ReturnType<typeof createClient>;
