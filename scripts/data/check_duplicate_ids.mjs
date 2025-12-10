#!/usr/bin/env node
/**
 * Deep analysis script to find potential duplicate row IDs in WhatsApp lists
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const BASE_DIR = './supabase/functions/wa-webhook';
const issues = [];

function getAllTsFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && !entry.includes('node_modules')) {
      getAllTsFiles(fullPath, files);
    } else if (entry.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractRowsFromSendListMessage(content, filePath) {
  // Find sendListMessage calls
  const listMessagePattern = /sendListMessage\s*\(\s*[^,]+,\s*\{[^}]*rows:\s*\[([^\]]*)\]/gs;
  let match;
  
  while ((match = listMessagePattern.exec(content)) !== null) {
    const rowsContent = match[1];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    // Extract id values from rows
    const idPattern = /id:\s*(['"`])(.*?)\1|id:\s*([A-Z_]+\.[A-Z_]+)/g;
    const ids = [];
    let idMatch;
    
    while ((idMatch = idPattern.exec(rowsContent)) !== null) {
      const id = idMatch[2] || idMatch[3];
      ids.push(id);
    }
    
    // Check for duplicates
    const seen = new Set();
    const duplicates = [];
    for (const id of ids) {
      if (seen.has(id)) {
        duplicates.push(id);
      }
      seen.add(id);
    }
    
    if (duplicates.length > 0) {
      issues.push({
        file: filePath,
        line: lineNumber,
        type: 'DUPLICATE_IDS',
        duplicates: [...new Set(duplicates)],
        allIds: ids,
      });
    }
    
    // Check for potentially conflicting IDS constants
    const idsConstants = ids.filter(id => id && id.startsWith('IDS.'));
    if (idsConstants.length > 1) {
      // Could be problematic if they map to same value
      issues.push({
        file: filePath,
        line: lineNumber,
        type: 'CHECK_IDS_CONSTANTS',
        constants: idsConstants,
      });
    }
  }
}

function checkDynamicMenuFunctions(content, filePath) {
  // Check for dynamic menu functions that might return duplicate IDs
  const patterns = [
    /fetchSubmenuItems\s*\(/g,
    /fetchProfileMenuItems\s*\(/g,
    /getSubmenuRows\s*\(/g,
    /submenuItemsToRows\s*\(/g,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      const lineNumber = content.substring(0, pattern.lastIndex).split('\n').length;
      issues.push({
        file: filePath,
        line: lineNumber,
        type: 'DYNAMIC_MENU',
        warning: 'Uses dynamic menu - verify idMapper function prevents duplicates',
      });
    }
  }
}

function checkMappingFunctions(content, filePath) {
  // Find ID mapping functions
  const mappingPattern = /function\s+(\w+)\s*\([^)]*\):\s*string\s*\{[^}]*mapping[^}]*\}/gs;
  let match;
  
  while ((match = mappingPattern.exec(content)) !== null) {
    const funcBody = match[0];
    const funcName = match[1];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    // Extract mapping entries
    const mappingEntries = {};
    const entryPattern = /['"`]([^'"`]+)['"`]:\s*([A-Z_]+\.[A-Z_]+|['"`][^'"`]+['"`])/g;
    let entryMatch;
    
    while ((entryMatch = entryPattern.exec(funcBody)) !== null) {
      const key = entryMatch[1];
      const value = entryMatch[2];
      if (!mappingEntries[value]) {
        mappingEntries[value] = [];
      }
      mappingEntries[value].push(key);
    }
    
    // Check for multiple keys mapping to same value
    for (const [value, keys] of Object.entries(mappingEntries)) {
      if (keys.length > 1) {
        issues.push({
          file: filePath,
          line: lineNumber,
          type: 'DUPLICATE_MAPPING',
          function: funcName,
          value: value,
          keys: keys,
        });
      }
    }
  }
}

function checkForMissingHandlers(content, filePath) {
  // Find case statements in routers
  const casePattern = /case\s+(['"`])([^'"`]+)\1:|case\s+([A-Z_]+\.[A-Z_]+):/g;
  const cases = new Set();
  let match;
  
  while ((match = casePattern.exec(content)) !== null) {
    const caseId = match[2] || match[3];
    cases.add(caseId);
  }
  
  // Find IDs used in sendListMessage but not in switch cases
  const rowIdsPattern = /id:\s*(['"`])(.*?)\1/g;
  const usedIds = new Set();
  
  while ((match = rowIdsPattern.exec(content)) !== null) {
    usedIds.add(match[2]);
  }
  
  const missingHandlers = [];
  for (const id of usedIds) {
    if (!cases.has(id) && !cases.has(`IDS.${id}`) && !id.includes('::') && !id.startsWith('BIZ') && !id.startsWith('VEH')) {
      missingHandlers.push(id);
    }
  }
  
  if (missingHandlers.length > 0 && filePath.includes('router')) {
    issues.push({
      file: filePath,
      type: 'MISSING_HANDLERS',
      ids: missingHandlers,
    });
  }
}

console.log('🔍 Deep Review: Checking for duplicate IDs and potential 500 errors...\n');

const files = getAllTsFiles(BASE_DIR);
console.log(`Found ${files.length} TypeScript files\n`);

for (const file of files) {
  try {
    const content = readFileSync(file, 'utf-8');
    extractRowsFromSendListMessage(content, file);
    checkDynamicMenuFunctions(content, file);
    checkMappingFunctions(content, file);
    checkForMissingHandlers(content, file);
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
}

// Group issues by type
const groupedIssues = {
  DUPLICATE_IDS: [],
  DUPLICATE_MAPPING: [],
  DYNAMIC_MENU: [],
  CHECK_IDS_CONSTANTS: [],
  MISSING_HANDLERS: [],
};

for (const issue of issues) {
  groupedIssues[issue.type].push(issue);
}

// Report findings
let totalCritical = 0;

if (groupedIssues.DUPLICATE_IDS.length > 0) {
  console.log('🚨 CRITICAL: Duplicate Row IDs Found (Will cause 500 errors)');
  console.log('=' .repeat(70));
  for (const issue of groupedIssues.DUPLICATE_IDS) {
    console.log(`\n${issue.file}:${issue.line}`);
    console.log(`  Duplicates: ${issue.duplicates.join(', ')}`);
    console.log(`  All IDs: [${issue.allIds.join(', ')}]`);
    totalCritical++;
  }
  console.log('\n');
}

if (groupedIssues.DUPLICATE_MAPPING.length > 0) {
  console.log('🚨 CRITICAL: Duplicate ID Mappings (Will cause 500 errors)');
  console.log('=' .repeat(70));
  for (const issue of groupedIssues.DUPLICATE_MAPPING) {
    console.log(`\n${issue.file}:${issue.line}`);
    console.log(`  Function: ${issue.function}`);
    console.log(`  Value: ${issue.value}`);
    console.log(`  Keys mapping to same value: ${issue.keys.join(', ')}`);
    totalCritical++;
  }
  console.log('\n');
}

if (groupedIssues.CHECK_IDS_CONSTANTS.length > 0) {
  console.log('⚠️  WARNING: Multiple IDS Constants Used (May cause duplicates)');
  console.log('=' .repeat(70));
  for (const issue of groupedIssues.CHECK_IDS_CONSTANTS) {
    console.log(`\n${issue.file}:${issue.line}`);
    console.log(`  Constants: ${issue.constants.join(', ')}`);
  }
  console.log('\n');
}

if (groupedIssues.DYNAMIC_MENU.length > 0) {
  console.log('ℹ️  INFO: Dynamic Menu Usage (Verify idMapper)');
  console.log('=' .repeat(70));
  for (const issue of groupedIssues.DYNAMIC_MENU) {
    console.log(`\n${issue.file}:${issue.line}`);
    console.log(`  ${issue.warning}`);
  }
  console.log('\n');
}

if (groupedIssues.MISSING_HANDLERS.length > 0) {
  console.log('⚠️  WARNING: Potentially Missing Route Handlers');
  console.log('=' .repeat(70));
  for (const issue of groupedIssues.MISSING_HANDLERS) {
    console.log(`\n${issue.file}`);
    console.log(`  IDs without handlers: ${issue.ids.join(', ')}`);
  }
  console.log('\n');
}

console.log('=' .repeat(70));
console.log(`\n📊 Summary:`);
console.log(`  Critical Issues: ${totalCritical}`);
console.log(`  Warnings: ${groupedIssues.CHECK_IDS_CONSTANTS.length + groupedIssues.MISSING_HANDLERS.length}`);
console.log(`  Info: ${groupedIssues.DYNAMIC_MENU.length}`);

if (totalCritical > 0) {
  console.log('\n❌ Found critical issues that will cause 500 errors!');
  process.exit(1);
} else {
  console.log('\n✅ No duplicate ID issues found!');
  process.exit(0);
}
