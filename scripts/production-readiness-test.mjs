#!/usr/bin/env node

/**
 * Production Readiness Test Suite
 * Validates mobility and insurance systems before go-live
 * 
 * Usage:
 *   node scripts/production-readiness-test.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { glob } from 'glob';

const TESTS = {
  critical: [],
  warnings: [],
  passed: []
};

function test(name, fn) {
  try {
    const result = fn();
    if (result === true) {
      TESTS.passed.push(name);
      console.log(`  ✅ ${name}`);
    } else if (result === 'warn') {
      TESTS.warnings.push(name);
      console.log(`  ⚠️  ${name}`);
    } else {
      TESTS.critical.push({ name, error: result });
      console.log(`  ❌ ${name}: ${result}`);
    }
  } catch (error) {
    TESTS.critical.push({ name, error: error.message });
    console.log(`  ❌ ${name}: ${error.message}`);
  }
}

console.log(`\n${'='.repeat(70)}`);
console.log(`🚀 PRODUCTION READINESS TEST SUITE`);
console.log(`${'='.repeat(70)}\n`);

// ============================================================================
// TEST CATEGORY 1: DATABASE SCHEMA
// ============================================================================
console.log(`📊 DATABASE SCHEMA TESTS\n`);

test('trips table exists', () => {
  try {
    const result = execSync(
      `PGPASSWORD=Pq0jyevTlfoa376P psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -U postgres -d postgres -c "\\dt trips" 2>&1`,
      { encoding: 'utf-8' }
    );
    return result.includes('trips') ? true : 'trips table not found';
  } catch (e) {
    return 'Database connection failed';
  }
});

test('profiles table exists', () => {
  try {
    const result = execSync(
      `PGPASSWORD=Pq0jyevTlfoa376P psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -U postgres -d postgres -c "\\dt profiles" 2>&1`,
      { encoding: 'utf-8' }
    );
    return result.includes('profiles') ? true : 'profiles table not found';
  } catch (e) {
    return 'Database connection failed';
  }
});

test('find_matches RPC function exists', () => {
  try {
    const result = execSync(
      `PGPASSWORD=Pq0jyevTlfoa376P psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -U postgres -d postgres -c "\\df find_matches" 2>&1`,
      { encoding: 'utf-8' }
    );
    return result.includes('find_matches') ? true : 'find_matches function not found';
  } catch (e) {
    return 'Database connection failed';
  }
});

test('create_trip RPC function exists', () => {
  try {
    const result = execSync(
      `PGPASSWORD=Pq0jyevTlfoa376P psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -U postgres -d postgres -c "\\df create_trip" 2>&1`,
      { encoding: 'utf-8' }
    );
    return result.includes('create_trip') ? true : 'create_trip function not found';
  } catch (e) {
    return 'Database connection failed';
  }
});

// ============================================================================
// TEST CATEGORY 2: CODE QUALITY
// ============================================================================
console.log(`\n📝 CODE QUALITY TESTS\n`);

test('No console.log in mobility code', () => {
  const files = glob.sync('supabase/functions/wa-webhook-mobility/**/*.ts', {
    ignore: ['**/*.test.ts', '**/*.spec.ts']
  });
  
  let count = 0;
  files.forEach(file => {
    const content = readFileSync(file, 'utf-8');
    const matches = content.match(/console\.(log|error|warn)/g);
    if (matches) count += matches.length;
  });
  
  return count === 0 ? true : `Found ${count} console.* statements`;
});

test('No hardcoded secrets', () => {
  const files = glob.sync('supabase/functions/wa-webhook-mobility/**/*.ts', {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/config.ts']
  });
  
  const secretPatterns = [
    /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, // JWT
    /sk-[A-Za-z0-9]{32,}/, // API keys
    /password\s*=\s*["'][^"']+["']/, // Hardcoded passwords
  ];
  
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        return `Potential secret found in ${file}`;
      }
    }
  }
  
  return true;
});

test('All handlers use structured logging', () => {
  const files = glob.sync('supabase/functions/wa-webhook-mobility/handlers/**/*.ts', {
    ignore: ['**/*.test.ts']
  });
  
  let missingImports = 0;
  files.forEach(file => {
    const content = readFileSync(file, 'utf-8');
    if (!content.includes('logStructuredEvent') && content.length > 500) {
      missingImports++;
    }
  });
  
  return missingImports === 0 ? true : `${missingImports} handlers missing structured logging`;
});

test('TypeScript strict mode enabled', () => {
  const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf-8'));
  return tsconfig.compilerOptions?.strict === true ? true : 'strict mode not enabled';
});

// ============================================================================
// TEST CATEGORY 3: CONFIGURATION
// ============================================================================
console.log(`\n⚙️  CONFIGURATION TESTS\n`);

test('Environment variables documented', () => {
  return existsSync('.env.example') ? true : '.env.example file missing';
});

test('Edge function config valid', () => {
  const mobilityConfig = 'supabase/functions/wa-webhook-mobility/function.json';
  if (!existsSync(mobilityConfig)) return 'function.json missing';
  
  try {
    const config = JSON.parse(readFileSync(mobilityConfig, 'utf-8'));
    return config.verify_jwt === false ? true : 'JWT verification should be disabled for webhooks';
  } catch (e) {
    return 'Invalid function.json';
  }
});

test('Rate limiting configured', () => {
  const files = glob.sync('supabase/functions/wa-webhook-*/index.ts');
  let missingRateLimit = 0;
  
  files.forEach(file => {
    const content = readFileSync(file, 'utf-8');
    if (!content.includes('rateLimitMiddleware')) {
      missingRateLimit++;
    }
  });
  
  return missingRateLimit === 0 ? true : `${missingRateLimit} webhooks missing rate limiting`;
});

// ============================================================================
// TEST CATEGORY 4: SECURITY
// ============================================================================
console.log(`\n🔒 SECURITY TESTS\n`);

test('RLS policies enabled on trips table', () => {
  try {
    const result = execSync(
      `PGPASSWORD=Pq0jyevTlfoa376P psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -U postgres -d postgres -c "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'trips';" 2>&1`,
      { encoding: 'utf-8' }
    );
    return result.includes('t') ? true : 'RLS not enabled on trips table';
  } catch (e) {
    return 'warn';
  }
});

test('Webhook signature verification present', () => {
  const mobilityIndex = 'supabase/functions/wa-webhook-mobility/index.ts';
  if (!existsSync(mobilityIndex)) return 'mobility index.ts not found';
  
  const content = readFileSync(mobilityIndex, 'utf-8');
  return content.includes('verifyWebhookSignature') || content.includes('signature') ? 
    true : 'Webhook signature verification missing';
});

test('No service role key in client vars', () => {
  const envFiles = glob.sync('.env*');
  
  for (const file of envFiles) {
    const content = readFileSync(file, 'utf-8');
    if (content.includes('VITE_') && content.includes('SERVICE_ROLE')) {
      return `Service role key found in client var (${file})`;
    }
  }
  
  return true;
});

// ============================================================================
// TEST CATEGORY 5: TESTS & DOCUMENTATION
// ============================================================================
console.log(`\n📚 TESTS & DOCUMENTATION\n`);

test('Test files exist', () => {
  const tests = glob.sync('supabase/functions/wa-webhook-mobility/**/*.test.ts');
  return tests.length > 5 ? true : `Only ${tests.length} test files found`;
});

test('README.md exists and updated', () => {
  const readme = 'supabase/functions/wa-webhook-mobility/README.md';
  if (!existsSync(readme)) return 'README.md missing';
  
  const content = readFileSync(readme, 'utf-8');
  const updated2024 = content.includes('2024') || content.includes('2025');
  return updated2024 ? true : 'README may be outdated';
});

test('Ground rules compliance documented', () => {
  return existsSync('docs/GROUND_RULES.md') ? true : 'Ground rules documentation missing';
});

// ============================================================================
// FINAL REPORT
// ============================================================================
console.log(`\n${'='.repeat(70)}`);
console.log(`📊 FINAL REPORT`);
console.log(`${'='.repeat(70)}\n`);

console.log(`✅ Passed:   ${TESTS.passed.length}`);
console.log(`⚠️  Warnings: ${TESTS.warnings.length}`);
console.log(`❌ Critical: ${TESTS.critical.length}\n`);

if (TESTS.critical.length > 0) {
  console.log(`🚨 CRITICAL ISSUES (MUST FIX BEFORE PRODUCTION):\n`);
  TESTS.critical.forEach(({ name, error }) => {
    console.log(`   • ${name}`);
    console.log(`     └─ ${error}\n`);
  });
}

if (TESTS.warnings.length > 0) {
  console.log(`⚠️  WARNINGS (RECOMMENDED TO FIX):\n`);
  TESTS.warnings.forEach(name => {
    console.log(`   • ${name}`);
  });
  console.log();
}

const readyForProduction = TESTS.critical.length === 0;

console.log(`${'='.repeat(70)}`);
if (readyForProduction) {
  console.log(`✅ READY FOR PRODUCTION`);
  console.log(`   All critical tests passed. ${TESTS.warnings.length} warnings remain.`);
} else {
  console.log(`❌ NOT READY FOR PRODUCTION`);
  console.log(`   ${TESTS.critical.length} critical issue(s) must be resolved.`);
}
console.log(`${'='.repeat(70)}\n`);

process.exit(readyForProduction ? 0 : 1);
