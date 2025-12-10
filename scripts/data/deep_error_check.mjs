#!/usr/bin/env node
/**
 * Comprehensive error analysis for wa-webhook
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
    if (stat.isDirectory() && !entry.includes('node_modules') && !entry.includes('test')) {
      getAllTsFiles(fullPath, files);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkMissingErrorHandling(content, filePath) {
  // Check for try-catch blocks with minimal error handling
  const tryCatchPattern = /try\s*\{([^}]*)\}\s*catch\s*\(([^)]*)\)\s*\{([^}]*)\}/gs;
  let match;
  
  while ((match = tryCatchPattern.exec(content)) !== null) {
    const catchBody = match[3].trim();
    const errorVar = match[2].trim();
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    // Check if error is properly logged or handled
    const hasLogging = catchBody.includes('console.') || catchBody.includes('log');
    const hasRethrow = catchBody.includes('throw');
    const hasUserMessage = catchBody.includes('sendButtonsMessage') || catchBody.includes('sendMessage');
    
    if (!hasLogging && !hasRethrow && !hasUserMessage) {
      issues.push({
        file: filePath,
        line: lineNumber,
        type: 'SILENT_ERROR',
        severity: 'HIGH',
        message: 'Catch block with no error handling/logging',
      });
    }
    
    // Check if error variable is unused
    if (errorVar && !catchBody.includes(errorVar.split(':')[0])) {
      issues.push({
        file: filePath,
        line: lineNumber,
        type: 'UNUSED_ERROR',
        severity: 'MEDIUM',
        message: `Error variable '${errorVar}' not used in catch block`,
      });
    }
  }
}

function checkUnsafePropertyAccess(content, filePath) {
  // Check for potential null/undefined access
  const patterns = [
    // Accessing .data without null check
    /const\s+(\w+)\s*=\s*(\w+)\.data;/g,
    // Accessing array [0] without length check
    /\.data\[0\]/g,
    // Accessing nested properties without optional chaining
    /\w+\.\w+\.\w+\s*(?!\?\.)/g,
  ];
  
  const lines = content.split('\n');
  
  // Check .data access
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Check for .data without null check nearby
    if (line.match(/const\s+\w+\s*=\s*\w+\.data;/) && !line.includes('||')) {
      const prevLines = lines.slice(Math.max(0, i - 3), i).join('\n');
      const nextLines = lines.slice(i + 1, i + 4).join('\n');
      
      if (!prevLines.includes('if') && !nextLines.includes('if') && !line.includes('?')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'UNSAFE_DATA_ACCESS',
          severity: 'MEDIUM',
          message: 'Accessing .data without null check',
        });
      }
    }
    
    // Check for array [0] access
    if (line.includes('.data[0]') && !line.includes('?.[0]')) {
      const context = lines.slice(Math.max(0, i - 2), i).join('\n');
      if (!context.includes('if') && !context.includes('length')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'UNSAFE_ARRAY_ACCESS',
          severity: 'HIGH',
          message: 'Accessing array [0] without length check',
        });
      }
    }
  }
}

function checkMissingAwait(content, filePath) {
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Check for .from() or .rpc() without await
    if ((line.includes('.from(') || line.includes('.rpc(')) && 
        !line.includes('await') && 
        !line.includes('return') &&
        !line.includes('//') &&
        line.includes('const')) {
      
      // Exclude function definitions
      if (!line.includes('function') && !line.includes('=>')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'MISSING_AWAIT',
          severity: 'HIGH',
          message: 'Supabase query without await',
          code: line.trim(),
        });
      }
    }
  }
}

function checkWhatsAppAPIErrors(content, filePath) {
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Check for sendListMessage/sendButtonsMessage in try-catch
    if (line.includes('sendListMessage') || line.includes('sendButtonsMessage')) {
      const prevLines = lines.slice(Math.max(0, i - 10), i).join('\n');
      const nextLines = lines.slice(i, Math.min(lines.length, i + 10)).join('\n');
      
      const inTryCatch = prevLines.includes('try {') && 
                         (nextLines.includes('} catch') || nextLines.includes('catch ('));
      
      if (!inTryCatch && !line.includes('//')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'UNPROTECTED_WA_CALL',
          severity: 'MEDIUM',
          message: 'WhatsApp API call not in try-catch block',
        });
      }
    }
  }
}

function checkButtonRows(content, filePath) {
  // Check for buttons with duplicate IDs
  const buttonPattern = /buttons:\s*\[([^\]]*)\]/gs;
  let match;
  
  while ((match = buttonPattern.exec(content)) !== null) {
    const buttonsContent = match[1];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    // Extract button IDs
    const idPattern = /id:\s*(['"`])(.*?)\1|id:\s*([A-Z_]+\.[A-Z_]+)/g;
    const ids = [];
    let idMatch;
    
    while ((idMatch = idPattern.exec(buttonsContent)) !== null) {
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
        type: 'DUPLICATE_BUTTON_IDS',
        severity: 'CRITICAL',
        message: `Duplicate button IDs: ${duplicates.join(', ')}`,
      });
    }
  }
}

function checkUnhandledInteractiveIds(content, filePath) {
  // Only check router files
  if (!filePath.includes('router/')) return;
  
  // Extract all case statements
  const casePattern = /case\s+(['"`])([^'"`]+)\1:|case\s+([A-Z_]+\.[A-Z_]+):/g;
  const handledIds = new Set();
  let match;
  
  while ((match = casePattern.exec(content)) !== null) {
    const id = match[2] || match[3];
    handledIds.add(id);
  }
  
  // Extract IDs used in interactive messages
  const usedPattern = /\{\s*id:\s*(['"`])([^'"`]+)\1|id:\s*([A-Z_]+\.[A-Z_]+)/g;
  const usedIds = new Set();
  
  while ((match = usedPattern.exec(content)) !== null) {
    const id = match[2] || match[3];
    if (id && !id.includes('::') && !id.startsWith('${')) {
      usedIds.add(id);
    }
  }
  
  // Find unhandled IDs
  const unhandled = [];
  for (const id of usedIds) {
    if (!handledIds.has(id) && !handledIds.has(`IDS.${id}`)) {
      unhandled.push(id);
    }
  }
  
  if (unhandled.length > 0) {
    issues.push({
      file: filePath,
      type: 'UNHANDLED_IDS',
      severity: 'HIGH',
      message: `${unhandled.length} IDs without handlers: ${unhandled.slice(0, 5).join(', ')}${unhandled.length > 5 ? '...' : ''}`,
    });
  }
}

console.log('🔍 Deep Error Analysis: wa-webhook\n');

const files = getAllTsFiles(BASE_DIR);
console.log(`Analyzing ${files.length} TypeScript files...\n`);

for (const file of files) {
  try {
    const content = readFileSync(file, 'utf-8');
    checkMissingErrorHandling(content, file);
    checkUnsafePropertyAccess(content, file);
    checkMissingAwait(content, file);
    checkWhatsAppAPIErrors(content, file);
    checkButtonRows(content, file);
    checkUnhandledInteractiveIds(content, file);
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
}

// Group and report
const grouped = {
  CRITICAL: [],
  HIGH: [],
  MEDIUM: [],
};

for (const issue of issues) {
  grouped[issue.severity].push(issue);
}

let totalIssues = 0;

if (grouped.CRITICAL.length > 0) {
  console.log('🚨 CRITICAL ISSUES (Will cause 500 errors)');
  console.log('='.repeat(70));
  for (const issue of grouped.CRITICAL) {
    console.log(`\n${issue.file}:${issue.line || ''}`);
    console.log(`  ${issue.type}: ${issue.message}`);
    if (issue.code) console.log(`  Code: ${issue.code}`);
    totalIssues++;
  }
  console.log('\n');
}

if (grouped.HIGH.length > 0) {
  console.log('⚠️  HIGH PRIORITY (Likely to cause errors)');
  console.log('='.repeat(70));
  const limited = grouped.HIGH.slice(0, 20);
  for (const issue of limited) {
    console.log(`\n${issue.file}:${issue.line || ''}`);
    console.log(`  ${issue.type}: ${issue.message}`);
    if (issue.code) console.log(`  Code: ${issue.code}`);
    totalIssues++;
  }
  if (grouped.HIGH.length > 20) {
    console.log(`\n... and ${grouped.HIGH.length - 20} more HIGH priority issues`);
  }
  console.log('\n');
}

if (grouped.MEDIUM.length > 0) {
  console.log(`ℹ️  MEDIUM PRIORITY: ${grouped.MEDIUM.length} issues (showing first 10)`);
  console.log('='.repeat(70));
  const limited = grouped.MEDIUM.slice(0, 10);
  for (const issue of limited) {
    console.log(`${issue.file}:${issue.line || ''} - ${issue.message}`);
  }
  console.log('\n');
}

console.log('='.repeat(70));
console.log(`\n📊 Summary:`);
console.log(`  Critical: ${grouped.CRITICAL.length}`);
console.log(`  High: ${grouped.HIGH.length}`);
console.log(`  Medium: ${grouped.MEDIUM.length}`);
console.log(`  Total: ${totalIssues}`);

if (grouped.CRITICAL.length > 0) {
  console.log('\n❌ CRITICAL issues found! These will cause 500 errors.');
  process.exit(1);
} else if (grouped.HIGH.length > 0) {
  console.log('\n⚠️  HIGH priority issues found. Review recommended.');
  process.exit(0);
} else {
  console.log('\n✅ No critical or high priority issues found!');
  process.exit(0);
}
