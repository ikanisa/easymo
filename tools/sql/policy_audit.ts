#!/usr/bin/env -S deno run --allow-read
// Simple policy audit: ensure RLS is enabled on key tables.

const SCHEMA_FILE = new URL("../../latest_schema.sql", import.meta.url).pathname;
const text = await Deno.readTextFile(SCHEMA_FILE);
const upper = text.toUpperCase();

const tables = [
  'settings',
  'admin_alert_prefs',
  'ibimina',
  'ibimina_members',
  'saccos',
  'sacco_officers',
  'sacco_loans',
  'sacco_collateral',
  'momo_unmatched',
  'contributions_ledger',
  'kyc_documents',
  'campaigns',
  'campaign_targets',
  'notifications',
  'audit_log',
];

const errors: string[] = [];

for (const t of tables) {
  const pattern = `ALTER TABLE PUBLIC.${t.toUpperCase()} ENABLE ROW LEVEL SECURITY`;
  if (!upper.includes(pattern)) {
    errors.push(`RLS not enabled for table: ${t}`);
  }
}

if (errors.length) {
  console.error('Policy audit failed:');
  for (const e of errors) console.error(' -', e);
  Deno.exit(1);
}

console.log('Policy audit passed: RLS enabled for required tables.');

