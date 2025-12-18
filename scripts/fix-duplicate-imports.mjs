#!/usr/bin/env node
/**
 * Fix Duplicate Imports
 * Automatically removes duplicate imports from files
 */

import { readFile, writeFile } from 'fs/promises';
import { readdir } from 'fs/promises';
import { join } from 'path';
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

function removeDuplicateImports(content) {
  const lines = content.split('\n');
  const seen = new Set();
  const result = [];
  let inImportBlock = false;
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const isImport = trimmed.startsWith('import ') || trimmed.startsWith('export ');
    
    if (isImport) {
      // Normalize import statement (remove extra spaces)
      const normalized = trimmed.replace(/\s+/g, ' ');
      
      if (seen.has(normalized)) {
        // Skip duplicate
        return;
      }
      
      seen.add(normalized);
      result.push(line);
      inImportBlock = true;
    } else {
      // If we were in import block and hit a non-import line, reset
      if (inImportBlock && trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('///')) {
        inImportBlock = false;
      }
      result.push(line);
    }
  });
  
  return result.join('\n');
}

async function fixDuplicates() {
  console.log('🔧 Fixing Duplicate Imports\n');
  console.log('='.repeat(60));
  
  const files = await findFiles(
    join(ROOT, 'supabase/functions'),
    /\.ts$/
  );
  
  let fixedCount = 0;
  
  for (const file of files) {
    try {
      const original = await readFile(file, 'utf-8');
      const fixed = removeDuplicateImports(original);
      
      if (original !== fixed) {
        await writeFile(file, fixed, 'utf-8');
        fixedCount++;
        console.log(`✅ Fixed: ${file.replace(ROOT + '/', '')}`);
      }
    } catch (err) {
      // Skip files that can't be read/written
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} files\n`);
}

fixDuplicates().catch(console.error);

