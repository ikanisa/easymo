#!/usr/bin/env node

/**
 * Push the schema cache reload migration to Supabase
 * This fixes the "Could not find the 'wa_message_id' column" error
 */

const { execSync } = require('child_process');

console.log('🔄 Pushing schema cache reload migration to Supabase...\n');

try {
  // Push the migration
  execSync('npx supabase db push', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n✅ Migration pushed successfully!');
  console.log('📝 PostgREST schema cache has been reloaded.');
  console.log('🔍 The wa_events table now correctly uses the "message_id" column.');
  
} catch (error) {
  console.error('\n❌ Failed to push migration:', error.message);
  process.exit(1);
}
