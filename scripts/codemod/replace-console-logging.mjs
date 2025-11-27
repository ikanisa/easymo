#!/usr/bin/env node
/**
 * Console.log to Structured Logging Codemod
 * 
 * Replaces console.log/warn/error with structured logging from @easymo/commons
 * 
 * Usage:
 *   node scripts/codemod/replace-console-logging.mjs [--dry-run] [--path=<path>]
 * 
 * Examples:
 *   node scripts/codemod/replace-console-logging.mjs --dry-run
 *   node scripts/codemod/replace-console-logging.mjs --path=services/profile
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_PATH = process.argv.find(arg => arg.startsWith('--path='))?.split('=')[1] || '.';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

const stats = {
  filesScanned: 0,
  filesModified: 0,
  consoleStatementsReplaced: 0,
  errors: 0,
};

/**
 * Find all TypeScript files in a directory
 */
async function findTsFiles(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, dist, .archive, etc.
    if (entry.name === 'node_modules' || 
        entry.name === 'dist' || 
        entry.name === '.archive' ||
        entry.name === '.git' ||
        entry.name === 'coverage') {
      continue;
    }
    
    if (entry.isDirectory()) {
      await findTsFiles(fullPath, files);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Determine the service/package name from file path
 */
function getServiceName(filePath) {
  const parts = filePath.split(path.sep);
  
  // Try to find service or package name
  const serviceIndex = parts.indexOf('services');
  const packageIndex = parts.indexOf('packages');
  
  if (serviceIndex !== -1 && parts[serviceIndex + 1]) {
    return parts[serviceIndex + 1];
  }
  
  if (packageIndex !== -1 && parts[packageIndex + 1]) {
    return parts[packageIndex + 1];
  }
  
  return 'unknown-service';
}

/**
 * Transform console.log to structured logging
 */
function transformFile(content, filePath) {
  const serviceName = getServiceName(filePath);
  let modified = false;
  let replacements = 0;
  
  // Check if file already imports logger
  const hasLoggerImport = /from ['"]@easymo\/commons['"]/.test(content) && 
                         /childLogger/.test(content);
  
  // Track console usage
  const consoleMatches = content.match(/console\.(log|warn|error|info|debug)/g);
  
  if (!consoleMatches || consoleMatches.length === 0) {
    return { content, modified: false, replacements: 0 };
  }
  
  let transformed = content;
  
  // Add logger import if not present
  if (!hasLoggerImport) {
    // Find the last import statement
    const importRegex = /^import\s+.*?from\s+['"].*?['"];?\s*$/gm;
    const imports = transformed.match(importRegex);
    
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const importIndex = transformed.lastIndexOf(lastImport);
      const afterImport = importIndex + lastImport.length;
      
      transformed = 
        transformed.slice(0, afterImport) +
        `\nimport { childLogger } from '@easymo/commons';\n\nconst log = childLogger({ service: '${serviceName}' });\n` +
        transformed.slice(afterImport);
      
      modified = true;
    }
  }
  
  // Replace console.log with structured logging
  const replacementMap = {
    'console.log': 'log.info',
    'console.info': 'log.info',
    'console.warn': 'log.warn',
    'console.error': 'log.error',
    'console.debug': 'log.debug',
  };
  
  for (const [consoleMethod, logMethod] of Object.entries(replacementMap)) {
    const regex = new RegExp(consoleMethod.replace('.', '\\.'), 'g');
    const beforeCount = (transformed.match(regex) || []).length;
    
    if (beforeCount > 0) {
      transformed = transformed.replace(regex, logMethod);
      replacements += beforeCount;
      modified = true;
    }
  }
  
  return { content: transformed, modified, replacements };
}

/**
 * Process a single file
 */
async function processFile(filePath) {
  try {
    stats.filesScanned++;
    
    const content = await fs.readFile(filePath, 'utf-8');
    const { content: transformed, modified, replacements } = transformFile(content, filePath);
    
    if (modified) {
      stats.filesModified++;
      stats.consoleStatementsReplaced += replacements;
      
      const relativePath = path.relative(process.cwd(), filePath);
      console.log(`${colors.yellow}Modified${colors.reset} ${relativePath}`);
      console.log(`  ${colors.green}+${replacements}${colors.reset} console → structured logging`);
      
      if (!DRY_RUN) {
        await fs.writeFile(filePath, transformed, 'utf-8');
      }
    }
    
    return { success: true, modified, replacements };
  } catch (error) {
    stats.errors++;
    console.error(`${colors.red}Error${colors.reset} processing ${filePath}:`, error.message);
    return { success: false, modified: false, replacements: 0 };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}  Console Logging Replacement${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  if (DRY_RUN) {
    console.log(`${colors.yellow}⚠️  DRY RUN MODE - No files will be modified${colors.reset}\n`);
  }
  
  const targetDir = path.resolve(process.cwd(), TARGET_PATH);
  console.log(`Scanning: ${targetDir}\n`);
  
  // Find all TypeScript files
  const files = await findTsFiles(targetDir);
  console.log(`Found ${files.length} TypeScript files\n`);
  
  // Process each file
  for (const file of files) {
    await processFile(file);
  }
  
  // Print summary
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.green}Summary${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`Files scanned:              ${stats.filesScanned}`);
  console.log(`Files modified:             ${colors.green}${stats.filesModified}${colors.reset}`);
  console.log(`Console statements replaced: ${colors.green}${stats.consoleStatementsReplaced}${colors.reset}`);
  console.log(`Errors:                     ${stats.errors > 0 ? colors.red : colors.green}${stats.errors}${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  if (DRY_RUN && stats.filesModified > 0) {
    console.log(`${colors.yellow}Run without --dry-run to apply changes${colors.reset}\n`);
  }
  
  if (!DRY_RUN && stats.filesModified > 0) {
    console.log(`${colors.green}✅ Changes applied successfully${colors.reset}\n`);
    console.log('Next steps:');
    console.log('1. Run: pnpm lint --fix');
    console.log('2. Run: pnpm type-check');
    console.log('3. Run: pnpm test');
    console.log('4. Review changes and commit\n');
  }
}

main().catch(console.error);
