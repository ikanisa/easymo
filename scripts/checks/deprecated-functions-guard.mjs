#!/usr/bin/env node
/**
 * Deprecated Edge Functions Guard
 * 
 * This script checks for references to deprecated edge functions in deployment
 * scripts and CI workflows. It fails if deprecated functions are found.
 * 
 * Usage:
 *   node scripts/checks/deprecated-functions-guard.mjs
 * 
 * Exit codes:
 *   0 - No deprecated functions found in deployment scripts
 *   1 - Deprecated functions detected in deployment scripts
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// List of deprecated functions that should NOT be deployed
// Add new deprecated functions here with their deprecation reason
const DEPRECATED_FUNCTIONS = {
  'wa-webhook': {
    issue: '#485',
    reason: 'Legacy monolithic handler replaced by wa-webhook-core + domain microservices',
    replacement: 'wa-webhook-core',
    deprecatedDate: '2025-11-24'
  }
};

// Files to scan for deployment commands
const FILES_TO_CHECK = [
  '.github/workflows/supabase-deploy.yml',
  '.github/workflows/supabase-functions-post-merge.yml',
  '.github/workflows/wa-webhook-microservices.yml',
  'package.json'
];

// Pattern to match Supabase function deployment commands
const DEPLOY_PATTERNS = [
  /supabase\s+functions\s+deploy\s+([^\\|&\n]+)/gi,
  /"functions:deploy[^"]*":\s*"([^"]+)"/gi,
  /FUNCTIONS:\s*"([^"]+)"/gi
];

/**
 * Extract function names from a deploy command string
 */
function extractFunctionNames(command) {
  // Remove flags with values like --project-ref value, --no-verify-jwt
  // Be careful not to consume function names that follow flags
  let cleanCommand = command;
  
  // First, remove flags with quoted values
  cleanCommand = cleanCommand.replace(/--[a-z-]+\s*=?\s*("[^"]*"|'[^']*')/gi, '');
  
  // Then, remove flags with unquoted values (but only if the value looks like a value, not a function name)
  // A value typically starts with $ (env var) or is a path or contains special chars
  cleanCommand = cleanCommand.replace(/--[a-z-]+\s*=?\s*(\$\{?[A-Z_]+\}?|[A-Z_]+|[^a-z\s]+)/gi, '');
  
  // Remove remaining flags without values
  cleanCommand = cleanCommand.replace(/--[a-z-]+/gi, '');
  
  // Remove env vars like $PROJECT_REF or ${PROJECT_REF}
  cleanCommand = cleanCommand.replace(/\$\{?[A-Z_]+\}?/g, '');
  
  // Clean up whitespace
  cleanCommand = cleanCommand.trim();
  
  // Extract function names (lowercase with dashes, like wa-webhook-core)
  return cleanCommand.split(/\s+/).filter(name => name && /^[a-z][a-z0-9-]*$/i.test(name));
}

/**
 * Check a file for deprecated function deployments
 */
function checkFile(filePath) {
  const fullPath = path.resolve(filePath);
  
  if (!fs.existsSync(fullPath)) {
    return { found: false, violations: [] };
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const violations = [];
  
  for (const pattern of DEPLOY_PATTERNS) {
    let match;
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(content)) !== null) {
      const commandStr = match[1];
      const functions = extractFunctionNames(commandStr);
      
      for (const fn of functions) {
        if (DEPRECATED_FUNCTIONS[fn]) {
          violations.push({
            file: filePath,
            function: fn,
            ...DEPRECATED_FUNCTIONS[fn],
            line: content.substring(0, match.index).split('\n').length
          });
        }
      }
    }
  }
  
  return {
    found: violations.length > 0,
    violations
  };
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Checking for deprecated edge function deployments...\n');
  
  const allViolations = [];
  
  for (const file of FILES_TO_CHECK) {
    const result = checkFile(file);
    if (result.found) {
      allViolations.push(...result.violations);
    }
  }
  
  if (allViolations.length === 0) {
    console.log('✅ No deprecated edge functions found in deployment scripts.\n');
    console.log('Deprecated functions guard passed.');
    return 0;
  }
  
  console.log('❌ DEPRECATED FUNCTIONS DETECTED IN DEPLOYMENT SCRIPTS!\n');
  console.log('The following deprecated functions are still referenced:\n');
  
  for (const v of allViolations) {
    console.log(`  📄 ${v.file}:${v.line}`);
    console.log(`     Function: ${v.function}`);
    console.log(`     Issue: ${v.issue}`);
    console.log(`     Reason: ${v.reason}`);
    console.log(`     Use instead: ${v.replacement}`);
    console.log(`     Deprecated: ${v.deprecatedDate}`);
    console.log('');
  }
  
  console.log('⚠️  ACTION REQUIRED:');
  console.log('   Remove deprecated function references from the files listed above.');
  console.log('   See the DEPRECATED.ts file in supabase/functions/wa-webhook/ for details.\n');
  
  return 1;
}

process.exit(main());
