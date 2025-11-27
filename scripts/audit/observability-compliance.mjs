#!/usr/bin/env node
/**
 * Observability Compliance Checker
 * 
 * Verifies that services follow EasyMO observability ground rules:
 * - Structured logging with correlation IDs
 * - PII masking in logs
 * - Proper logger usage (no console.log)
 * - Event tracking for key operations
 * 
 * Usage:
 *   node scripts/audit/observability-compliance.mjs [--path=<path>] [--strict]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STRICT_MODE = process.argv.includes('--strict');
const TARGET_PATH = process.argv.find(arg => arg.startsWith('--path='))?.split('=')[1] || 'services';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

const results = {
  servicesScanned: 0,
  compliant: 0,
  nonCompliant: 0,
  issues: [],
};

/**
 * Check if a file imports structured logging
 */
function hasStructuredLogging(content) {
  return /import.*childLogger.*from.*@easymo\/commons/.test(content) ||
         /import.*logStructuredEvent.*from/.test(content) ||
         /from ['"]pino['"]/.test(content);
}

/**
 * Check for console usage (should be zero)
 */
function hasConsoleUsage(content) {
  const matches = content.match(/console\.(log|info|debug)/g);
  return matches ? matches.length : 0;
}

/**
 * Check for correlation ID usage
 */
function hasCorrelationId(content) {
  return /correlationId|correlation-id|x-correlation-id|requestId/i.test(content);
}

/**
 * Check for structured event logging
 */
function hasStructuredEvents(content) {
  return /log\.(info|warn|error|debug)\s*\(\s*\{/.test(content) ||
         /logStructuredEvent/.test(content);
}

/**
 * Check for PII masking
 */
function hasPiiMasking(content) {
  return /mask|redact|sanitize|obfuscate/i.test(content) ||
         /serializers/.test(content);
}

/**
 * Audit a single service
 */
async function auditService(servicePath) {
  const serviceName = path.basename(servicePath);
  results.servicesScanned++;
  
  const issues = [];
  let score = 0;
  const maxScore = STRICT_MODE ? 6 : 4;
  
  try {
    // Read main entry point
    const entryPoints = ['src/main.ts', 'src/server.ts', 'src/index.ts', 'index.ts'];
    let content = '';
    let entryFound = false;
    
    for (const entry of entryPoints) {
      const filePath = path.join(servicePath, entry);
      try {
        content = await fs.readFile(filePath, 'utf-8');
        entryFound = true;
        break;
      } catch {
        continue;
      }
    }
    
    if (!entryFound) {
      issues.push('❌ No entry point found (src/main.ts, src/server.ts, or src/index.ts)');
      results.nonCompliant++;
      results.issues.push({ service: serviceName, issues });
      return { serviceName, compliant: false, score, maxScore, issues };
    }
    
    // Check 1: Structured logging import
    if (hasStructuredLogging(content)) {
      score++;
    } else {
      issues.push('❌ Missing structured logging import (@easymo/commons or pino)');
    }
    
    // Check 2: No console usage
    const consoleCount = hasConsoleUsage(content);
    if (consoleCount === 0) {
      score++;
    } else {
      issues.push(`❌ Found ${consoleCount} console.log/info/debug statements`);
    }
    
    // Check 3: Correlation ID handling
    if (hasCorrelationId(content)) {
      score++;
    } else {
      issues.push('⚠️  No correlation ID usage detected');
    }
    
    // Check 4: Structured event logging
    if (hasStructuredEvents(content)) {
      score++;
    } else {
      issues.push('⚠️  No structured event logging detected');
    }
    
    // Strict mode checks
    if (STRICT_MODE) {
      // Check 5: PII masking
      if (hasPiiMasking(content)) {
        score++;
      } else {
        issues.push('⚠️  No PII masking/serializers detected');
      }
      
      // Check 6: Error handling with logging
      if (/catch.*log\.error/s.test(content)) {
        score++;
      } else {
        issues.push('⚠️  Error handling may not log properly');
      }
    }
    
    const compliant = score >= (STRICT_MODE ? 5 : 3);
    
    if (compliant) {
      results.compliant++;
    } else {
      results.nonCompliant++;
      results.issues.push({ service: serviceName, issues, score, maxScore });
    }
    
    return { serviceName, compliant, score, maxScore, issues };
    
  } catch (error) {
    issues.push(`❌ Error scanning service: ${error.message}`);
    results.nonCompliant++;
    results.issues.push({ service: serviceName, issues });
    return { serviceName, compliant: false, score, maxScore, issues };
  }
}

/**
 * Find all services
 */
async function findServices(dir) {
  const services = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      const servicePath = path.join(dir, entry.name);
      // Check if it looks like a service (has package.json)
      try {
        await fs.access(path.join(servicePath, 'package.json'));
        services.push(servicePath);
      } catch {
        // Not a service directory
      }
    }
  }
  
  return services;
}

/**
 * Main execution
 */
async function main() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}  Observability Compliance Audit${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  if (STRICT_MODE) {
    console.log(`${colors.yellow}⚠️  STRICT MODE - All checks required${colors.reset}\n`);
  }
  
  const targetDir = path.resolve(process.cwd(), TARGET_PATH);
  console.log(`Scanning: ${targetDir}\n`);
  
  const services = await findServices(targetDir);
  console.log(`Found ${services.length} services\n`);
  
  // Audit each service
  const auditResults = [];
  for (const service of services) {
    const result = await auditService(service);
    auditResults.push(result);
    
    const icon = result.compliant ? colors.green + '✓' : colors.red + '✗';
    const scoreColor = result.score >= result.maxScore * 0.7 ? colors.green : 
                       result.score >= result.maxScore * 0.5 ? colors.yellow : colors.red;
    
    console.log(`${icon} ${result.serviceName}${colors.reset} - ${scoreColor}${result.score}/${result.maxScore}${colors.reset}`);
    
    if (!result.compliant || result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`  ${issue}`));
    }
    console.log();
  }
  
  // Summary
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Summary${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`Services scanned:    ${results.servicesScanned}`);
  console.log(`Compliant:           ${colors.green}${results.compliant}${colors.reset}`);
  console.log(`Non-compliant:       ${results.nonCompliant > 0 ? colors.red : colors.green}${results.nonCompliant}${colors.reset}`);
  
  const complianceRate = results.servicesScanned > 0 ? 
    ((results.compliant / results.servicesScanned) * 100).toFixed(1) : 0;
  const rateColor = complianceRate >= 80 ? colors.green : 
                    complianceRate >= 60 ? colors.yellow : colors.red;
  
  console.log(`Compliance rate:     ${rateColor}${complianceRate}%${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  // Recommendations
  if (results.nonCompliant > 0) {
    console.log(`${colors.yellow}Recommendations:${colors.reset}`);
    console.log('1. Import structured logging: import { childLogger } from "@easymo/commons"');
    console.log('2. Remove all console.log statements (use log.info instead)');
    console.log('3. Add correlation IDs to all requests');
    console.log('4. Use structured event logging: log.info({ event: "...", ...data }, "message")');
    if (STRICT_MODE) {
      console.log('5. Add PII masking with pino serializers');
      console.log('6. Log all errors in catch blocks');
    }
    console.log();
  }
  
  // Exit code
  const exitCode = results.nonCompliant > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch(console.error);
