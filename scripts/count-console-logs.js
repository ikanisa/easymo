#!/usr/bin/env node

/**
 * Phase 3-4: Console.log Usage Counter
 * Counts and reports console.log usage across the codebase
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const DIRS_TO_SCAN = ['services', 'packages', 'admin-app', 'client-pwa'];
const FILE_EXTENSIONS = ['.ts', '.tsx'];

function scanDirectory(dir, results = { files: [], totalCount: 0, byDir: {} }) {
  if (!fs.existsSync(dir)) {
    return results;
  }
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    
    // Skip node_modules, dist, build
    if (item === 'node_modules' || item === 'dist' || item === 'build' || item === '.next') {
      continue;
    }
    
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanDirectory(fullPath, results);
    } else {
      const ext = path.extname(item);
      if (FILE_EXTENSIONS.includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const matches = content.match(/console\.log/g);
        
        if (matches) {
          const count = matches.length;
          results.totalCount += count;
          results.files.push({ path: fullPath, count });
          
          // Track by top-level directory
          const topDir = fullPath.split(path.sep)[0];
          results.byDir[topDir] = (results.byDir[topDir] || 0) + count;
        }
      }
    }
  }
  
  return results;
}

function main() {
  console.log(`${COLORS.blue}📊 Counting console.log usage...${COLORS.reset}\n`);
  
  const results = { files: [], totalCount: 0, byDir: {} };
  
  DIRS_TO_SCAN.forEach(dir => {
    scanDirectory(dir, results);
  });
  
  console.log(`${COLORS.yellow}═══════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.yellow}  Console.log Usage Report${COLORS.reset}`);
  console.log(`${COLORS.yellow}═══════════════════════════════════════${COLORS.reset}\n`);
  
  console.log(`${COLORS.green}Total console.log calls: ${results.totalCount}${COLORS.reset}`);
  console.log(`Files affected: ${results.files.length}\n`);
  
  console.log(`${COLORS.blue}Breakdown by directory:${COLORS.reset}`);
  Object.entries(results.byDir)
    .sort((a, b) => b[1] - a[1])
    .forEach(([dir, count]) => {
      console.log(`  ${dir}: ${count}`);
    });
  
  if (results.files.length > 0) {
    console.log(`\n${COLORS.blue}Top offenders:${COLORS.reset}`);
    results.files
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .forEach(({ path, count }) => {
        console.log(`  ${count.toString().padStart(3)} - ${path}`);
      });
  }
  
  console.log(`\n${COLORS.yellow}Target: 0 console.log calls${COLORS.reset}`);
  console.log(`${COLORS.yellow}Next step: Replace with structured logging${COLORS.reset}\n`);
  
  // Save baseline
  const baseline = {
    timestamp: new Date().toISOString(),
    totalCount: results.totalCount,
    filesAffected: results.files.length,
    byDirectory: results.byDir,
    files: results.files,
  };
  
  fs.writeFileSync(
    'console-log-baseline.json',
    JSON.stringify(baseline, null, 2)
  );
  
  console.log(`${COLORS.green}✓ Baseline saved to console-log-baseline.json${COLORS.reset}\n`);
}

main();
