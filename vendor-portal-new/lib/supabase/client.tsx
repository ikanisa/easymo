"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { requireSupabaseConfig } from "@/lib/supabase/config";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  const { url, anonKey } = requireSupabaseConfig("supabase-browser-client");

  if (!client) {
    client = createBrowserClient<Database>(url, anonKey);
  }

  return client;
}
