#!/usr/bin/env node

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SLA_ALERT_WEBHOOK_URL',
  'SUPABASE_CHANNEL_MONITOR_WEBHOOK',
  'AGENT_AUDIT_WEBHOOK_URL',
];

const missing = requiredVars.filter((key) => {
  const value = process.env[key];
  return !value || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error('\n❌ Environment verification failed.');
  console.error('The following required variables are missing:');
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  console.error('\nSet these variables locally (e.g. in .env) before running staging or production deploys.');
  process.exit(1);
}

console.log('✅ All critical environment variables are set.');

// Additional recommendations (non-fatal)
const optionalVars = [
  'WA_INSURANCE_ADMIN_TEMPLATE',
  'WA_TEMPLATE_LANG',
  'WA_DRIVER_NOTIFY_TEMPLATE',
];
const missingOptional = optionalVars.filter((k) => !process.env[k]);
if (missingOptional.length) {
  console.warn('\nℹ️ Recommended env variables missing (optional):');
  for (const key of missingOptional) console.warn(`  - ${key}`);
}

// Wallet system profile
console.log('\nChecking wallet system profile setting...');
try {
  // Best-effort dynamic import of supabase config if available
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.76.1');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.from('wallet_settings').select('key, value').eq('key', 'wallet_system_profile_id').maybeSingle();
    if (error) {
      console.warn('  ⚠️ Could not verify wallet_system_profile_id:', error.message);
    } else if (!data?.value) {
      console.warn('  ⚠️ wallet_system_profile_id not set. Admin allocations may fail.');
    } else {
      console.log('  ✅ wallet_system_profile_id is set.');
    }
  }
} catch (_) {
  // ignore
}
