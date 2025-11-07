#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "❌ Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents).",
  );
  process.exit(1);
}

const table = process.argv[2] ?? "agent_registry";

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

try {
  const { data, error } = await client.from(table).select("*").limit(1);
  if (error) {
    console.error("❌ Supabase connection error:", error.message);
    process.exit(1);
  }
  console.log(
    `✅ Supabase connection succeeded (table: ${table})`,
    data ?? [],
  );
  process.exit(0);
} catch (error) {
  console.error("❌ Supabase connection threw:", error);
  process.exit(1);
}
