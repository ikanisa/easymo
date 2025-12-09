import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";

// Helper to create an admin client with full table access
// Use this when you need to access tables not in the main Database type
export const createSupabaseAdminClient = () => {
  const client = createSupabaseServiceRoleClient("createSupabaseAdminClient", {
    auth: {
      autoRefreshToken: false,
    },
  });
  // Cast to any to allow access to all tables (including countries, country_config, telco_providers, etc.)
  return client as any;
};
