import { createClient } from "@supabase/supabase-js";
import { settings } from "./config";

export const supabase = createClient(
  settings.supabase.url,
  settings.supabase.serviceRoleKey,
  {
    auth: { persistSession: false },
  },
);
