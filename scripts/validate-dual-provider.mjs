#!/usr/bin/env node
/**
 * Validation Script for Dual-Provider AI Architecture
 * 
 * Verifies that the implementation meets all requirements from the problem statement
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const WAITER_FILES = [
  'supabase/functions/wa-webhook-waiter/agent.ts',
  'supabase/functions/wa-webhook-waiter/providers/dual-ai-provider.ts',
  'supabase/functions/wa-agent-waiter/core/providers/gemini.ts',
  'supabase/functions/wa-agent-waiter/core/providers/dual-ai-provider.ts',
  'supabase/functions/wa-agent-waiter/core/waiter-agent.ts',
];

const PROHIBITED_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4o-mini',
];

const REQUIRED_MODELS = ['gpt-5', 'gemini-3'];

const REQUIRED_OBSERVABILITY = [
  'logStructuredEvent',
  'provider',
  'model',
  'fallbackUsed',
];

console.log('🔍 Validating Dual-Provider AI Architecture Implementation\n');

let passed = 0;
let failed = 0;

// Test 1: All required files exist
console.log('Test 1: Checking required files exist...');
WAITER_FILES.forEach(file => {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
    passed++;
  } else {
    console.log(`  ❌ ${file} - NOT FOUND`);
    failed++;
  }
});

// Test 2: No prohibited models in waiter files
console.log('\nTest 2: Checking for prohibited models...');
let prohibitedFound = false;
WAITER_FILES.forEach(file => {
  const fullPath = path.join(rootDir, file);
  if (!fs.existsSync(fullPath)) return;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  PROHIBITED_MODELS.forEach(model => {
    if (content.includes(model)) {
      console.log(`  ❌ ${file} contains prohibited model: ${model}`);
      prohibitedFound = true;
      failed++;
    }
  });
});
if (!prohibitedFound) {
  console.log('  ✅ No prohibited models found in waiter files');
  passed++;
}

// Test 3: Required models present
console.log('\nTest 3: Checking for required models (gpt-5, gemini-3)...');
const dualProviderFiles = [
  'supabase/functions/wa-webhook-waiter/providers/dual-ai-provider.ts',
  'supabase/functions/wa-agent-waiter/core/providers/dual-ai-provider.ts',
];

dualProviderFiles.forEach(file => {
  const fullPath = path.join(rootDir, file);
  if (!fs.existsSync(fullPath)) return;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  let fileHasBothModels = true;
  
  REQUIRED_MODELS.forEach(model => {
    if (!content.includes(`'${model}'`) && !content.includes(`"${model}"`)) {
      console.log(`  ❌ ${file} missing required model: ${model}`);
      fileHasBothModels = false;
      failed++;
    }
  });
  
  if (fileHasBothModels) {
    console.log(`  ✅ ${file} contains both required models`);
    passed++;
  }
});

// Also check gemini.ts has gemini-3
const geminiFile = 'supabase/functions/wa-agent-waiter/core/providers/gemini.ts';
const geminiPath = path.join(rootDir, geminiFile);
if (fs.existsSync(geminiPath)) {
  const content = fs.readFileSync(geminiPath, 'utf8');
  if (content.includes("'gemini-3'") || content.includes('"gemini-3"')) {
    console.log(`  ✅ ${geminiFile} uses gemini-3 model`);
    passed++;
  } else {
    console.log(`  ❌ ${geminiFile} does not use gemini-3 model`);
    failed++;
  }
}

// Test 4: Observability implementation
console.log('\nTest 4: Checking observability implementation...');
const observabilityFiles = [
  'supabase/functions/wa-webhook-waiter/providers/dual-ai-provider.ts',
  'supabase/functions/wa-webhook-waiter/agent.ts',
  'supabase/functions/wa-agent-waiter/core/providers/dual-ai-provider.ts',
];

observabilityFiles.forEach(file => {
  const fullPath = path.join(rootDir, file);
  if (!fs.existsSync(fullPath)) return;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  let hasAllRequired = true;
  
  REQUIRED_OBSERVABILITY.forEach(term => {
    if (!content.includes(term)) {
      console.log(`  ❌ ${file} missing observability term: ${term}`);
      hasAllRequired = false;
    }
  });
  
  if (hasAllRequired) {
    console.log(`  ✅ ${file} has complete observability`);
    passed++;
  } else {
    failed++;
  }
});

// Test 5: Dual provider architecture
console.log('\nTest 5: Checking dual provider architecture...');
dualProviderFiles.forEach(file => {
  const fullPath = path.join(rootDir, file);
  if (!fs.existsSync(fullPath)) return;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Should have chatWithOpenAI and chatWithGemini methods
  const hasOpenAI = content.includes('chatWithOpenAI');
  const hasGemini = content.includes('chatWithGemini');
  const hasFailover = content.includes('fallback') || content.includes('Fallback');
  
  if (hasOpenAI && hasGemini && hasFailover) {
    console.log(`  ✅ ${file} implements dual provider with failover`);
    passed++;
  } else {
    console.log(`  ❌ ${file} missing dual provider components`);
    if (!hasOpenAI) console.log('     - Missing OpenAI implementation');
    if (!hasGemini) console.log('     - Missing Gemini implementation');
    if (!hasFailover) console.log('     - Missing failover logic');
    failed++;
  }
});

// Test 6: Agent integration
console.log('\nTest 6: Checking agent integration...');
const agentFile = 'supabase/functions/wa-webhook-waiter/agent.ts';
const agentPath = path.join(rootDir, agentFile);
if (fs.existsSync(agentPath)) {
  const content = fs.readFileSync(agentPath, 'utf8');
  
  const importsDualProvider = content.includes('DualAIProvider');
  const usesDualProvider = content.includes('new DualAIProvider()');
  const logsProvider = content.includes('WAITER_AI_RESPONSE') && content.includes('provider');
  
  if (importsDualProvider && usesDualProvider && logsProvider) {
    console.log(`  ✅ ${agentFile} properly integrates DualAIProvider`);
    passed++;
  } else {
    console.log(`  ❌ ${agentFile} integration issues`);
    if (!importsDualProvider) console.log('     - Missing DualAIProvider import');
    if (!usesDualProvider) console.log('     - Not using DualAIProvider');
    if (!logsProvider) console.log('     - Missing provider logging');
    failed++;
  }
}

const waiterAgentFile = 'supabase/functions/wa-agent-waiter/core/waiter-agent.ts';
const waiterAgentPath = path.join(rootDir, waiterAgentFile);
if (fs.existsSync(waiterAgentPath)) {
  const content = fs.readFileSync(waiterAgentPath, 'utf8');
  
  const importsDualProvider = content.includes('DualAIProvider');
  const usesDualProvider = content.includes('new DualAIProvider()');
  
  if (importsDualProvider && usesDualProvider) {
    console.log(`  ✅ ${waiterAgentFile} properly integrates DualAIProvider`);
    passed++;
  } else {
    console.log(`  ❌ ${waiterAgentFile} integration issues`);
    if (!importsDualProvider) console.log('     - Missing DualAIProvider import');
    if (!usesDualProvider) console.log('     - Not using DualAIProvider');
    failed++;
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log('\n✅ All validation tests passed!');
  console.log('\nImplementation Summary:');
  console.log('  ✓ Dual-provider architecture with automatic failover');
  console.log('  ✓ Primary: OpenAI GPT-5');
  console.log('  ✓ Fallback: Google Gemini-3');
  console.log('  ✓ No deprecated models in waiter agent');
  console.log('  ✓ Complete observability logging');
  console.log('  ✓ Proper integration in both waiter implementations');
  process.exit(0);
} else {
  console.log('\n❌ Some validation tests failed. Please review the output above.');
  process.exit(1);
}
