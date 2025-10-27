#!/usr/bin/env node
/**
 * check-client-secrets.mjs
 * 
 * Security guard script that scans client-facing directories for references
 * to server-only environment variables and secrets.
 * 
 * Exits with non-zero status if any violations are found.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');

// Server-only environment variable names that should NEVER appear in client code
const SERVER_ONLY_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
  'FLOW_DATA_CHANNEL_TOKEN',
  'FLOW_ENCRYPTION_PRIVATE_KEY',
  'OCR_API_KEY',
  'VOUCHER_SIGNING_SECRET',
  'QR_TOKEN_SECRET',
  'BRIDGE_SHARED_SECRET',
];

// Client-facing directories to scan
const CLIENT_DIRS = [
  'app',
  'admin-app',
  'public',
  'easymo/admin-app',
];

// Patterns that indicate server-side code (allowed to use secrets)
const SERVER_SIDE_PATTERNS = [
  '/api/',
  '/lib/server/',
  'middleware.ts',
  'middleware.js',
  '.server.ts',
  '.server.js',
  'runtime-config.ts', // Configuration module used by server-side code
];

// File extensions to scan
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html'];

// Files/directories to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  'coverage',
  '.turbo',
  'check-client-secrets.mjs', // Ignore this script itself
];

/**
 * Recursively scan directory for files
 */
function* scanDirectory(dir) {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      
      // Skip ignored patterns
      if (IGNORE_PATTERNS.some(pattern => entry.includes(pattern))) {
        continue;
      }
      
      try {
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          yield* scanDirectory(fullPath);
        } else if (stat.isFile()) {
          const hasValidExtension = SCAN_EXTENSIONS.some(ext => entry.endsWith(ext));
          if (hasValidExtension) {
            yield fullPath;
          }
        }
      } catch (err) {
        // Skip files we can't access
        continue;
      }
    }
  } catch (err) {
    // Skip directories we can't access
    return;
  }
}

/**
 * Check if file is server-side code (allowed to use secrets)
 */
function isServerSideFile(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return SERVER_SIDE_PATTERNS.some(pattern => normalizedPath.includes(pattern));
}

/**
 * Check file for server-only secret references
 */
function checkFile(filePath) {
  // Skip server-side files - they're allowed to use secrets
  if (isServerSideFile(filePath)) {
    return [];
  }
  
  const violations = [];
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const secret of SERVER_ONLY_SECRETS) {
      // Look for references to the secret name
      // This includes process.env.SECRET, "SECRET", 'SECRET', etc.
      const regex = new RegExp(`['"\`]?${secret}['"\`]?`, 'g');
      
      lines.forEach((line, index) => {
        if (regex.test(line)) {
          violations.push({
            file: relative(ROOT_DIR, filePath),
            line: index + 1,
            secret: secret,
            content: line.trim().substring(0, 100), // First 100 chars
          });
        }
      });
    }
  } catch (err) {
    // Skip files we can't read
  }
  
  return violations;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Scanning client-facing directories for server secrets...\n');
  
  const allViolations = [];
  
  for (const clientDir of CLIENT_DIRS) {
    const fullPath = join(ROOT_DIR, clientDir);
    
    try {
      statSync(fullPath);
    } catch {
      // Directory doesn't exist, skip
      continue;
    }
    
    console.log(`Scanning ${clientDir}/...`);
    
    let fileCount = 0;
    for (const filePath of scanDirectory(fullPath)) {
      fileCount++;
      const violations = checkFile(filePath);
      if (violations.length > 0) {
        allViolations.push(...violations);
      }
    }
    
    console.log(`  ✓ Scanned ${fileCount} files`);
  }
  
  console.log('');
  
  if (allViolations.length === 0) {
    console.log('✅ No server secrets found in client code!');
    process.exit(0);
  } else {
    console.error('❌ SECURITY VIOLATION: Server secrets found in client code!\n');
    
    // Group violations by file
    const violationsByFile = {};
    for (const violation of allViolations) {
      if (!violationsByFile[violation.file]) {
        violationsByFile[violation.file] = [];
      }
      violationsByFile[violation.file].push(violation);
    }
    
    // Print violations
    for (const [file, violations] of Object.entries(violationsByFile)) {
      console.error(`\n📁 ${file}:`);
      for (const v of violations) {
        console.error(`   Line ${v.line}: ${v.secret}`);
        console.error(`   → ${v.content}`);
      }
    }
    
    console.error(`\n❌ Found ${allViolations.length} violation(s) in ${Object.keys(violationsByFile).length} file(s)`);
    console.error('\nServer-only secrets must NOT be referenced in client-facing code.');
    console.error('Use NEXT_PUBLIC_* variables for client-safe configuration only.\n');
    
    process.exit(1);
  }
}

main();
