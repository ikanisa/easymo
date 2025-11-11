#!/usr/bin/env node
/**
 * Phase 2: WhatsApp Integration Validation
 * 
 * Validates that all AI agents are properly integrated with WhatsApp workflows
 * and that all fallbacks are properly implemented.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const AGENTS = [
  {
    name: 'Nearby Drivers Agent',
    type: 'nearby_drivers',
    supabaseFunction: 'supabase/functions/agent-negotiation/index.ts',
    packageAgent: 'packages/agents/src/agents/drivers/nearby-drivers.agent.ts',
    waIntegration: 'supabase/functions/wa-webhook/domains/ai-agents/integration.ts',
    adminPage: 'admin-app/app/(panel)/agents/driver-negotiation',
    apiRoute: 'admin-app/app/api/agents/driver-requests/route.ts',
  },
  {
    name: 'Pharmacy Agent',
    type: 'pharmacy',
    supabaseFunction: 'supabase/functions/agent-negotiation/index.ts',
    packageAgent: 'packages/agents/src/agents/pharmacy/pharmacy.agent.ts',
    waIntegration: 'supabase/functions/wa-webhook/domains/ai-agents/integration.ts',
    adminPage: 'admin-app/app/(panel)/agents/pharmacy',
    apiRoute: 'admin-app/app/api/agents/pharmacy-requests/route.ts',
  },
  {
    name: 'Property Rental Agent',
    type: 'property_rental',
    supabaseFunction: 'supabase/functions/agent-property-rental/index.ts',
    packageAgent: 'packages/agents/src/agents/property/property-rental.agent.ts',
    waIntegration: 'supabase/functions/wa-webhook/domains/ai-agents/integration.ts',
    adminPage: 'admin-app/app/(panel)/agents/property-rental',
    apiRoute: 'admin-app/app/api/agents/property-rentals/route.ts',
  },
  {
    name: 'Schedule Trip Agent',
    type: 'schedule_trip',
    supabaseFunction: 'supabase/functions/agent-schedule-trip/index.ts',
    packageAgent: 'packages/agents/src/agents/schedule/schedule-trip.agent.ts',
    waIntegration: 'supabase/functions/wa-webhook/domains/ai-agents/integration.ts',
    adminPage: 'admin-app/app/(panel)/agents/schedule-trip',
    apiRoute: 'admin-app/app/api/agents/schedule-trips/route.ts',
  },
  {
    name: 'Shops Agent',
    type: 'shops',
    supabaseFunction: 'supabase/functions/agent-shops/index.ts',
    packageAgent: 'packages/agents/src/agents/shops/shops.agent.ts',
    waIntegration: 'supabase/functions/wa-webhook/domains/ai-agents/integration.ts',
    adminPage: 'admin-app/app/(panel)/agents/shops',
    apiRoute: 'admin-app/app/api/agents/shops/route.ts',
  },
  {
    name: 'Quincaillerie Agent',
    type: 'quincaillerie',
    supabaseFunction: 'supabase/functions/agent-quincaillerie/index.ts',
    packageAgent: 'packages/agents/src/agents/quincaillerie/quincaillerie.agent.ts',
    waIntegration: 'supabase/functions/wa-webhook/domains/ai-agents/integration.ts',
    adminPage: 'admin-app/app/(panel)/agents/quincaillerie',
    apiRoute: null, // May not have dedicated API route
  },
];

const FALLBACK_CHECKS = [
  {
    name: 'HTTP Error Fallback',
    pattern: /if\s*\(!response\.ok\)/,
    description: 'Handles HTTP errors from agent function',
  },
  {
    name: 'Network Error Fallback',
    pattern: /catch\s*\(\s*\w+\s*\)/,
    description: 'Handles network/exception errors',
  },
  {
    name: 'User-Friendly Message',
    pattern: /(Sorry|Unable|couldn't)/i,
    description: 'Provides user-friendly error messages',
  },
  {
    name: 'Alternative Actions',
    pattern: /(try|Try|alternative|Alternative)/i,
    description: 'Suggests alternative actions to users',
  },
];

let errors = [];
let warnings = [];
let passed = 0;

console.log('🔍 Phase 2: Validating WhatsApp Agent Integrations\n');
console.log('=' .repeat(60));

function checkFile(filepath) {
  const fullPath = join(process.cwd(), filepath);
  if (!existsSync(fullPath)) {
    return { exists: false, content: null };
  }
  try {
    const content = readFileSync(fullPath, 'utf-8');
    return { exists: true, content };
  } catch (error) {
    return { exists: false, content: null, error: error.message };
  }
}

function validateAgent(agent) {
  console.log(`\n📋 Validating: ${agent.name}`);
  console.log('-'.repeat(60));

  let agentPassed = true;

  // Check 1: Supabase function exists
  const supabaseFunc = checkFile(agent.supabaseFunction);
  if (supabaseFunc.exists) {
    console.log(`  ✅ Supabase function: ${agent.supabaseFunction}`);
  } else {
    console.log(`  ❌ Supabase function missing: ${agent.supabaseFunction}`);
    errors.push(`${agent.name}: Missing Supabase function`);
    agentPassed = false;
  }

  // Check 2: Package agent exists
  const packageAgent = checkFile(agent.packageAgent);
  if (packageAgent.exists) {
    console.log(`  ✅ Package agent: ${agent.packageAgent}`);
  } else {
    console.log(`  ❌ Package agent missing: ${agent.packageAgent}`);
    errors.push(`${agent.name}: Missing package agent`);
    agentPassed = false;
  }

  // Check 3: WA integration exists and has agent type
  const waIntegration = checkFile(agent.waIntegration);
  if (waIntegration.exists) {
    if (waIntegration.content.includes(`"${agent.type}"`)) {
      console.log(`  ✅ WhatsApp integration configured for: ${agent.type}`);
    } else {
      console.log(`  ⚠️  WhatsApp integration missing agent type: ${agent.type}`);
      warnings.push(`${agent.name}: Agent type not found in WA integration`);
    }
  } else {
    console.log(`  ❌ WhatsApp integration missing`);
    errors.push(`${agent.name}: Missing WA integration file`);
    agentPassed = false;
  }

  // Check 4: Admin page exists
  const adminPagePath = join(agent.adminPage, 'page.tsx');
  const adminPage = checkFile(adminPagePath);
  if (adminPage.exists) {
    console.log(`  ✅ Admin page exists`);
  } else {
    console.log(`  ⚠️  Admin page missing: ${adminPagePath}`);
    warnings.push(`${agent.name}: Missing admin page`);
  }

  // Check 5: API route exists (if expected)
  if (agent.apiRoute) {
    const apiRoute = checkFile(agent.apiRoute);
    if (apiRoute.exists) {
      console.log(`  ✅ API route exists`);
    } else {
      console.log(`  ⚠️  API route missing: ${agent.apiRoute}`);
      warnings.push(`${agent.name}: Missing API route`);
    }
  }

  // Check 6: Validate fallback implementations in WA integration
  if (waIntegration.exists && waIntegration.content) {
    console.log(`\n  🔧 Checking fallback implementations:`);
    
    // Find the agent function in the integration file
    const functionPattern = new RegExp(`async function invoke${agent.name.split(' ')[0]}Agent`, 'i');
    const functionMatch = waIntegration.content.match(functionPattern);
    
    if (functionMatch) {
      // Extract function body
      const functionStart = waIntegration.content.indexOf(functionMatch[0]);
      const nextFunctionPattern = /async function invoke\w+Agent/g;
      let functionEnd = waIntegration.content.length;
      
      nextFunctionPattern.lastIndex = functionStart + functionMatch[0].length;
      const nextMatch = nextFunctionPattern.exec(waIntegration.content);
      if (nextMatch) {
        functionEnd = nextMatch.index;
      }
      
      const functionBody = waIntegration.content.substring(functionStart, functionEnd);
      
      FALLBACK_CHECKS.forEach(check => {
        if (check.pattern.test(functionBody)) {
          console.log(`    ✅ ${check.name}: ${check.description}`);
        } else {
          console.log(`    ❌ ${check.name}: Missing ${check.description}`);
          errors.push(`${agent.name}: Missing ${check.name}`);
          agentPassed = false;
        }
      });
    } else {
      console.log(`    ⚠️  Could not find agent function in integration file`);
      warnings.push(`${agent.name}: Could not validate fallback logic`);
    }
  }

  if (agentPassed) {
    passed++;
    console.log(`\n  ✅ Agent validation: PASSED`);
  } else {
    console.log(`\n  ❌ Agent validation: FAILED`);
  }

  return agentPassed;
}

// Validate each agent
console.log('\n🚀 Starting agent validation...\n');

AGENTS.forEach(agent => {
  validateAgent(agent);
});

// Summary
console.log('\n\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));
console.log(`\n✅ Passed: ${passed}/${AGENTS.length} agents`);
console.log(`❌ Errors: ${errors.length}`);
console.log(`⚠️  Warnings: ${warnings.length}`);

if (errors.length > 0) {
  console.log('\n❌ ERRORS:');
  errors.forEach((error, index) => {
    console.log(`  ${index + 1}. ${error}`);
  });
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  warnings.forEach((warning, index) => {
    console.log(`  ${index + 1}. ${warning}`);
  });
}

console.log('\n' + '='.repeat(60));

// Exit with appropriate code
if (errors.length > 0) {
  console.log('\n❌ Validation FAILED. Please fix the errors above.\n');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('\n⚠️  Validation PASSED with warnings. Review warnings above.\n');
  process.exit(0);
} else {
  console.log('\n✅ Validation PASSED. All agents are properly integrated!\n');
  process.exit(0);
}
