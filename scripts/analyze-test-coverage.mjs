#!/usr/bin/env node
/**
 * Test Coverage Analysis Script
 * Analyzes test coverage and identifies gaps
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

async function findFiles(dir, pattern, exclude = []) {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(ROOT, fullPath);
      
      if (exclude.some(ex => relPath.includes(ex))) continue;
      
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
          continue;
        }
        files.push(...await findFiles(fullPath, pattern, exclude));
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Directory doesn't exist or can't be read
  }
  return files;
}

async function analyzeCoverage() {
  console.log('📊 Test Coverage Analysis\n');
  console.log('='.repeat(60));
  
  // Find all source files
  const sourceFiles = await findFiles(
    join(ROOT, 'supabase/functions'),
    /\.ts$/,
    ['node_modules', '__tests__', '.test.ts', '.spec.ts', 'deno.json']
  );
  
  // Find all test files
  const testFiles = await findFiles(
    join(ROOT, 'supabase/functions'),
    /\.(test|spec)\.ts$/,
    ['node_modules']
  );
  
  console.log(`\n📁 Files Found:`);
  console.log(`   Source files: ${sourceFiles.length}`);
  console.log(`   Test files: ${testFiles.length}`);
  console.log(`   Coverage ratio: ${((testFiles.length / sourceFiles.length) * 100).toFixed(1)}% (file count only)\n`);
  
  // Analyze by directory
  const dirStats = new Map();
  
  for (const file of sourceFiles) {
    const relPath = relative(join(ROOT, 'supabase/functions'), file);
    const dir = relPath.split('/')[0] || 'root';
    const stats = dirStats.get(dir) || { source: 0, tests: 0 };
    stats.source++;
    dirStats.set(dir, stats);
  }
  
  for (const file of testFiles) {
    const relPath = relative(join(ROOT, 'supabase/functions'), file);
    const dir = relPath.split('/')[0] || 'root';
    const stats = dirStats.get(dir) || { source: 0, tests: 0 };
    stats.tests++;
    dirStats.set(dir, stats);
  }
  
  console.log('📊 Coverage by Directory:\n');
  console.log('Directory'.padEnd(40) + 'Source'.padEnd(10) + 'Tests'.padEnd(10) + 'Ratio');
  console.log('-'.repeat(70));
  
  const sortedDirs = Array.from(dirStats.entries())
    .sort((a, b) => b[1].source - a[1].source);
  
  for (const [dir, stats] of sortedDirs) {
    const ratio = stats.source > 0 
      ? ((stats.tests / stats.source) * 100).toFixed(1) + '%'
      : 'N/A';
    console.log(
      dir.padEnd(40) + 
      stats.source.toString().padEnd(10) + 
      stats.tests.toString().padEnd(10) + 
      ratio
    );
  }
  
  // Identify files without tests
  console.log('\n\n🎯 Priority Files Needing Tests:\n');
  console.log('='.repeat(60));
  
  const criticalDirs = ['_shared', 'wa-webhook-core', 'wa-webhook-profile', 'wa-webhook-mobility', 'notify-buyers'];
  const filesWithoutTests = [];
  
  for (const file of sourceFiles) {
    const relPath = relative(join(ROOT, 'supabase/functions'), file);
    const dir = relPath.split('/')[0];
    
    if (!criticalDirs.includes(dir)) continue;
    
    const baseName = file.replace(/\.ts$/, '');
    const hasTest = testFiles.some(tf => 
      tf.startsWith(baseName + '.test') || 
      tf.startsWith(baseName + '.spec') ||
      tf.includes(relPath.replace(/\.ts$/, ''))
    );
    
    if (!hasTest) {
      filesWithoutTests.push(relPath);
    }
  }
  
  // Group by directory
  const grouped = new Map();
  for (const file of filesWithoutTests.slice(0, 30)) {
    const dir = file.split('/')[0];
    if (!grouped.has(dir)) grouped.set(dir, []);
    grouped.get(dir).push(file);
  }
  
  for (const [dir, files] of Array.from(grouped.entries()).sort()) {
    console.log(`\n📁 ${dir}/`);
    for (const file of files.slice(0, 5)) {
      console.log(`   - ${file}`);
    }
    if (files.length > 5) {
      console.log(`   ... and ${files.length - 5} more`);
    }
  }
  
  console.log('\n\n💡 Recommendations:\n');
  console.log('1. Focus on _shared/ utilities first (used by all functions)');
  console.log('2. Add tests for wa-webhook-* handlers (critical paths)');
  console.log('3. Test error handling and edge cases');
  console.log('4. Add integration tests for workflows');
  console.log('5. Target 80%+ coverage for critical modules\n');
}

analyzeCoverage().catch(console.error);

