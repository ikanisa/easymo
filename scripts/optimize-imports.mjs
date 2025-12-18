#!/usr/bin/env node
/**
 * Import Optimization Analyzer
 * Analyzes imports for optimization opportunities
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

function analyzeImports(content) {
  const lines = content.split('\n');
  const imports = [];
  let importCount = 0;
  let dynamicImportCount = 0;
  let heavyImports = [];
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('import ')) {
      importCount++;
      imports.push({ line: index + 1, content: trimmed });
      
      // Check for heavy imports
      if (trimmed.includes('llm') || trimmed.includes('agent') || trimmed.includes('gemini') || trimmed.includes('openai')) {
        heavyImports.push({ line: index + 1, content: trimmed });
      }
    }
    
    if (trimmed.includes('await import(') || trimmed.includes('import(')) {
      dynamicImportCount++;
    }
  });
  
  return {
    importCount,
    dynamicImportCount,
    heavyImports,
    topLevelImports: imports.slice(0, 20), // First 20 imports
  };
}

async function analyze() {
  console.log('📊 Import Optimization Analysis\n');
  console.log('='.repeat(60));
  
  const files = await findFiles(
    join(ROOT, 'supabase/functions'),
    /index\.ts$/
  );
  
  const results = [];
  
  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const analysis = analyzeImports(content);
      const relPath = relative(join(ROOT, 'supabase/functions'), file);
      
      if (analysis.importCount > 15 || analysis.heavyImports.length > 0) {
        results.push({
          file: relPath,
          ...analysis,
        });
      }
    } catch (err) {
      // Skip files that can't be read
    }
  }
  
  // Sort by import count
  results.sort((a, b) => b.importCount - a.importCount);
  
  console.log(`\n📁 Files with Many Imports (>15) or Heavy Imports:\n`);
  
  for (const result of results.slice(0, 10)) {
    console.log(`\n📄 ${result.file}`);
    console.log(`   Total imports: ${result.importCount}`);
    console.log(`   Dynamic imports: ${result.dynamicImportCount}`);
    if (result.heavyImports.length > 0) {
      console.log(`   ⚠️  Heavy imports: ${result.heavyImports.length}`);
      for (const imp of result.heavyImports.slice(0, 3)) {
        console.log(`      Line ${imp.line}: ${imp.content.substring(0, 70)}...`);
      }
    }
  }
  
  console.log('\n\n💡 Optimization Recommendations:\n');
  console.log('1. Move heavy imports (LLM, agents) to lazy loading');
  console.log('2. Use dynamic imports for optional features');
  console.log('3. Consolidate imports from same module');
  console.log('4. Consider splitting large files with many imports');
  console.log('5. Use the lazy loader utility for handlers\n');
}

analyze().catch(console.error);

