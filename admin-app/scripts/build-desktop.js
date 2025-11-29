#!/usr/bin/env node

/**
 * Desktop build script
 * Uses the desktop-specific Next.js config for static export
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏗️  Building EasyMO Admin for Desktop...\n');

// Set environment variable for desktop build
process.env.TAURI_ENV_PLATFORM = 'true';
process.env.NEXT_PUBLIC_IS_DESKTOP = 'true';
process.env.ESLINT_NO_DEV_ERRORS = 'true';
process.env.SKIP_ENV_VALIDATION = 'true';

try {
  // Run Next.js build with desktop config
  console.log('📦 Building Next.js app with static export...');
  execSync('next build', {
    stdio: 'inherit',
    cwd: __dirname + '/..',
  });

  console.log('\n✅ Desktop build complete! Output in ./out directory');
  console.log('🚀 Run "npm run tauri:build" to create desktop installers\n');
} catch (error) {
  console.error('\n❌ Desktop build failed:', error.message);
  process.exit(1);
}
