import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

export type SupabaseClient = ReturnType<typeof createClient>;
