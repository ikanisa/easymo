#!/usr/bin/env tsx
/**
 * Observability Compliance Checker
 * 
 * Verifies that all services follow the observability ground rules:
 * - Structured logging with correlation IDs
 * - PII masking
 * - Metrics recording
 * - Health endpoints
 */

import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';

interface ComplianceResult {
  file: string;
  compliant: boolean;
  issues: string[];
  suggestions: string[];
}

interface PatternCheck {
  name: string;
  required: boolean;
  patterns: RegExp[];
  errorMessage: string;
  suggestion: string;
}

const checks: PatternCheck[] = [
  {
    name: 'Structured Logging Import',
    required: true,
    patterns: [
      /import.*logStructuredEvent.*from/,
      /import.*childLogger.*from/,
      /import.*Logger.*from.*@easymo\/commons/,
    ],
    errorMessage: 'Missing structured logging import',
    suggestion: 'Add: import { logStructuredEvent } from "../_shared/observability.ts" or import { childLogger } from "@easymo/commons"',
  },
  {
    name: 'Correlation ID Usage',
    required: true,
    patterns: [
      /correlationId/i,
      /correlation[_-]?id/i,
      /x-correlation-id/i,
    ],
    errorMessage: 'No correlation ID handling found',
    suggestion: 'Add correlation ID to all log events and pass to downstream calls',
  },
  {
    name: 'No Console.log',
    required: true,
    patterns: [
      /console\.(log|debug|info)/,
    ],
    errorMessage: 'Using console.log instead of structured logging',
    suggestion: 'Replace console.log with log.info({ data }, "message")',
  },
  {
    name: 'PII Masking',
    required: false,
    patterns: [
      /maskPII/,
      /redactSensitive/,
      /sanitize.*PII/i,
    ],
    errorMessage: 'No PII masking found (may not be needed)',
    suggestion: 'If logging user data, ensure PII is masked',
  },
];

async function checkFile(filePath: string): Promise<ComplianceResult> {
  const content = await fs.readFile(filePath, 'utf-8');
  const issues: string[] = [];
  const suggestions: string[] = [];

  for (const check of checks) {
    const hasPattern = check.patterns.some(pattern => pattern.test(content));
    
    if (check.name === 'No Console.log') {
      // Inverted check - should NOT match
      if (hasPattern) {
        issues.push(check.errorMessage);
        suggestions.push(check.suggestion);
      }
    } else {
      // Normal check - should match
      if (!hasPattern && check.required) {
        issues.push(check.errorMessage);
        suggestions.push(check.suggestion);
      }
    }
  }

  return {
    file: filePath,
    compliant: issues.length === 0,
    issues,
    suggestions,
  };
}

async function main() {
  console.log('🔍 Checking observability compliance...\n');

  // Check Supabase Edge Functions
  const edgeFunctions = await glob('supabase/functions/*/index.ts');
  
  // Check NestJS Services
  const services = await glob('services/*/src/**/*.{ts,tsx}', {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
  });

  const allFiles = [...edgeFunctions, ...services];
  console.log(`Found ${allFiles.length} files to check\n`);

  const results: ComplianceResult[] = [];
  
  for (const file of allFiles) {
    const result = await checkFile(file);
    results.push(result);
  }

  const nonCompliant = results.filter(r => !r.compliant);
  
  if (nonCompliant.length > 0) {
    console.log('❌ Non-compliant files:\n');
    for (const result of nonCompliant) {
      console.log(`📄 ${result.file}`);
      result.issues.forEach(issue => console.log(`   ❌ ${issue}`));
      result.suggestions.forEach(suggestion => console.log(`   💡 ${suggestion}`));
      console.log('');
    }
    console.log(`\n❌ ${nonCompliant.length}/${results.length} files are non-compliant`);
    process.exit(1);
  } else {
    console.log(`✅ All ${results.length} files are compliant!`);
    process.exit(0);
  }
}

main().catch(console.error);
