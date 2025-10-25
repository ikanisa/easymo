process.env.SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";
process.env.SERVICE_URL ??= process.env.SUPABASE_URL;
process.env.SERVICE_ROLE_KEY ??= process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.JWT_SIGNING_KEY ??= "test-signing-key";
process.env.BRIDGE_SHARED_SECRET ??= "test-bridge-secret";
