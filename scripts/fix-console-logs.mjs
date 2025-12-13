#!/usr/bin/env node

/**
 * Replace console.log with structured logging
 * 
 * Usage:
 *   node scripts/fix-console-logs.mjs [--dry-run] [--path=supabase/functions/wa-webhook-mobility]
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { dirname, relative } from 'path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const pathArg = args.find(a => a.startsWith('--path='));
const searchPath = pathArg ? pathArg.split('=')[1] : 'supabase/functions/wa-webhook-mobility';

console.log(`🔍 Scanning ${searchPath} for console.log statements...`);
console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE FIX'}\n`);

// Find all TypeScript files (excluding tests)
const files = glob.sync(`${searchPath}/**/*.ts`, {
  ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
});

let totalFiles = 0;
let totalReplacements = 0;
const changes = [];

files.forEach(file => {
  const content = readFileSync(file, 'utf-8');
  let modified = content;
  let fileReplacements = 0;

  // Pattern 1: console.log(...)
  const consoleLogRegex = /console\.log\((.*?)\);?/g;
  
  // Pattern 2: console.error(...)
  const consoleErrorRegex = /console\.error\((.*?)\);?/g;
  
  // Pattern 3: console.warn(...)
  const consoleWarnRegex = /console\.warn\((.*?)\);?/g;

  // Check if file already imports logStructuredEvent
  const hasImport = /import.*logStructuredEvent.*from/.test(content);
  
  // Replace console.log
  if (consoleLogRegex.test(content)) {
    modified = modified.replace(consoleLogRegex, (match, args) => {
      fileReplacements++;
      
      // Try to extract meaningful event name from the log
      const firstArg = args.split(',')[0].trim();
      let eventName = 'LOG_EVENT';
      
      if (firstArg.includes('DEBUG')) {
        eventName = 'DEBUG';
      } else if (firstArg.includes('loaded') || firstArg.includes('Loaded')) {
        eventName = 'MODULE_LOADED';
      } else if (firstArg.includes('called') || firstArg.includes('Called')) {
        eventName = 'FUNCTION_CALLED';
      }
      
      // If single string argument, make it the event name
      if (!args.includes(',') && firstArg.startsWith('"') && firstArg.endsWith('"')) {
        return `logStructuredEvent(${firstArg}, {});`;
      }
      
      // Multiple arguments - first is event, rest is payload
      const [first, ...rest] = args.split(',').map(s => s.trim());
      if (rest.length > 0) {
        return `logStructuredEvent("${eventName}", { message: ${first}, data: ${rest.join(', ')} });`;
      }
      
      return `logStructuredEvent("${eventName}", { data: ${args} });`;
    });
  }

  // Replace console.error
  if (consoleErrorRegex.test(content)) {
    modified = modified.replace(consoleErrorRegex, (match, args) => {
      fileReplacements++;
      return `logStructuredEvent("ERROR", { error: ${args} }, "error");`;
    });
  }

  // Replace console.warn
  if (consoleWarnRegex.test(content)) {
    modified = modified.replace(consoleWarnRegex, (match, args) => {
      fileReplacements++;
      return `logStructuredEvent("WARNING", { message: ${args} }, "warn");`;
    });
  }

  // Add import if needed and changes were made
  if (fileReplacements > 0 && !hasImport) {
    // Find the right path to observability.ts based on file location
    const relPath = relative(dirname(file), searchPath);
    const depth = relPath.split('/').filter(p => p === '..').length || 1;
    const importPath = '../'.repeat(depth) + '_shared/observability.ts';
    
    // Add import after other imports
    const importStatement = `import { logStructuredEvent } from "${importPath}";\n`;
    
    // Find last import statement
    const lastImportMatch = modified.match(/import.*from.*;\n/g);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      modified = modified.replace(lastImport, lastImport + importStatement);
    } else {
      // No imports, add at top
      modified = importStatement + modified;
    }
  }

  if (fileReplacements > 0) {
    totalFiles++;
    totalReplacements += fileReplacements;
    changes.push({
      file: relative(process.cwd(), file),
      replacements: fileReplacements
    });

    if (!dryRun) {
      writeFileSync(file, modified, 'utf-8');
    }
  }
});

// Report results
console.log(`\n${'='.repeat(70)}`);
console.log(`📊 SUMMARY`);
console.log(`${'='.repeat(70)}`);
console.log(`Files scanned:     ${files.length}`);
console.log(`Files modified:    ${totalFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`${'='.repeat(70)}\n`);

if (changes.length > 0) {
  console.log(`📝 Changes:\n`);
  changes.forEach(({ file, replacements }) => {
    console.log(`  ✓ ${file} (${replacements} replacement${replacements > 1 ? 's' : ''})`);
  });
  console.log();
}

if (dryRun) {
  console.log(`⚠️  DRY RUN MODE - No files were modified`);
  console.log(`   Run without --dry-run to apply changes\n`);
} else {
  console.log(`✅ Changes applied successfully!\n`);
}

process.exit(0);
