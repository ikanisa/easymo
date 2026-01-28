#!/usr/bin/env node

const profile = (process.env.EASYMO_ENV_PROFILE || 'core')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const requiredGroups = {
  core: [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_JWT_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SLA_ALERT_WEBHOOK_URL',
    'SUPABASE_CHANNEL_MONITOR_WEBHOOK',
    'AGENT_AUDIT_WEBHOOK_URL',
  ],
  admin: [
    'EASYMO_ADMIN_TOKEN',
    'ADMIN_SESSION_SECRET',
  ],
  ai: [
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
  ],
};

const requiredAnyGroups = {
  whatsapp: [
    ['WHATSAPP_ACCESS_TOKEN', 'WA_TOKEN', 'WABA_ACCESS_TOKEN'],
    ['WHATSAPP_PHONE_NUMBER_ID', 'WA_PHONE_ID', 'WABA_PHONE_NUMBER_ID'],
    ['WHATSAPP_APP_SECRET', 'WA_APP_SECRET'],
    ['WHATSAPP_VERIFY_TOKEN', 'WA_VERIFY_TOKEN'],
  ],
};

const requiredVars = new Set(requiredGroups.core);

for (const key of profile) {
  const group = requiredGroups[key];
  if (group) {
    group.forEach((item) => requiredVars.add(item));
  }
}

const missing = Array.from(requiredVars).filter((key) => {
  const value = process.env[key];
  return !value || value.trim().length === 0;
});

const missingAny = [];
for (const key of profile) {
  const groups = requiredAnyGroups[key];
  if (!groups) continue;
  for (const candidates of groups) {
    const found = candidates.some((candidate) => {
      const value = process.env[candidate];
      return value && value.trim().length > 0;
    });
    if (!found) {
      missingAny.push(candidates.join(' | '));
    }
  }
}

if (missing.length > 0 || missingAny.length > 0) {
  console.error('\n❌ Environment verification failed.');
  console.error('The following required variables are missing:');
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  for (const options of missingAny) {
    console.error(`  - ${options}`);
  }
  console.error('\nProfile:', profile.join(', ') || 'core');
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
