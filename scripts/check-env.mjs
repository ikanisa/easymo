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
