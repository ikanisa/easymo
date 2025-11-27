#!/usr/bin/env node
/**
 * Build-time environment variable check for Next.js admin app.
 * Ensures required public environment variables are set before building.
 */

// Load .env.local if it exists
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=');
        // Only set if not already set
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

const requiredAtBuild = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

const missing = requiredAtBuild.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('\n❌ Build Error: Missing required environment variables:');
  missing.forEach((key) => console.error(`   - ${key}`));
  console.error('\nThese variables must be set before building.');
  console.error('See admin-app/.env.example for reference.\n');
  process.exit(1);
}

console.log('✅ Environment variables check passed');

