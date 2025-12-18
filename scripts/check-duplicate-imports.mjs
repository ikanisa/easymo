#!/usr/bin/env node
/**
 * Check for duplicate imports in Edge Functions
 * Helps identify performance issues and code quality problems
 */

import { readFile } from 'fs/promises';
import { readdir } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

async function findFiles(dir, pattern) {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build' || entry.name === '__tests__') {
          continue;
        }
        files.push(...await findFiles(fullPath, pattern));
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Directory doesn't exist
  }
  return files;
}

function findDuplicateImports(content) {
  const lines = content.split('\n');
  const imports = new Map();
  const duplicates = [];
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
      // Normalize import statement
      const normalized = trimmed.replace(/\s+/g, ' ');
      if (imports.has(normalized)) {
        duplicates.push({
          line: index + 1,
          import: normalized,
          firstSeen: imports.get(normalized),
        });
      } else {
        imports.set(normalized, index + 1);
      }
    }
  });
  
  return duplicates;
}

async function analyzeImports() {
  console.log('🔍 Checking for Duplicate Imports\n');
  console.log('='.repeat(60));
  
  const files = await findFiles(
    join(ROOT, 'supabase/functions'),
    /\.ts$/
  );
  
  let totalDuplicates = 0;
  const filesWithDuplicates = [];
  
  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const duplicates = findDuplicateImports(content);
      
      if (duplicates.length > 0) {
        totalDuplicates += duplicates.length;
        filesWithDuplicates.push({
          file: relative(ROOT, file),
          duplicates,
        });
      }
    } catch (err) {
      // Skip files that can't be read
    }
  }
  
  if (filesWithDuplicates.length === 0) {
    console.log('\n✅ No duplicate imports found!\n');
    return;
  }
  
  console.log(`\n⚠️  Found ${totalDuplicates} duplicate imports in ${filesWithDuplicates.length} files:\n`);
  
  for (const { file, duplicates } of filesWithDuplicates) {
    console.log(`\n📁 ${file}`);
    for (const dup of duplicates) {
      console.log(`   Line ${dup.line}: Duplicate of line ${dup.firstSeen}`);
      console.log(`   ${dup.import.substring(0, 80)}${dup.import.length > 80 ? '...' : ''}`);
    }
  }
  
  console.log('\n\n💡 Recommendations:');
  console.log('1. Remove duplicate imports');
  console.log('2. Consolidate imports from same module');
  console.log('3. Use import aliases if needed');
  console.log('4. This improves cold start performance\n');
}

analyzeImports().catch(console.error);

