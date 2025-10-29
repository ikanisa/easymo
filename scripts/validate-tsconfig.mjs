#!/usr/bin/env node
/**
 * Validate all TypeScript configuration files in the repository
 * Usage: node scripts/validate-tsconfig.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let hasErrors = false;

function log(level, message, path = '') {
  const prefix = {
    info: '📝',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  }[level];
  
  const pathStr = path ? ` ${relative(root, path)}` : '';
  console.log(`${prefix}${pathStr}: ${message}`);
}

// Strip comments from JSON to support JSONC (TypeScript config format)
function stripJsonComments(jsonString) {
  return jsonString
    // Remove single-line comments
    .replace(/\/\/.*$/gm, '')
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove trailing commas (also valid in JSONC)
    .replace(/,(\s*[}\]])/g, '$1');
}

function validateJson(path) {
  try {
    const content = readFileSync(path, 'utf8');
    const stripped = stripJsonComments(content);
    JSON.parse(stripped);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

function validateTsConfig(path) {
  const result = validateJson(path);
  
  if (!result.valid) {
    log('error', `Invalid JSON: ${result.error}`, path);
    hasErrors = true;
    return false;
  }
  
  try {
    const content = readFileSync(path, 'utf8');
    const stripped = stripJsonComments(content);
    const config = JSON.parse(stripped);
    const issues = [];
    
    // Check for extends path
    if (config.extends) {
      const extendsPath = join(dirname(path), config.extends);
      if (!existsSync(extendsPath)) {
        issues.push(`extends path not found: ${config.extends}`);
      }
    }
    
    // Check for common issues
    if (config.compilerOptions) {
      const opts = config.compilerOptions;
      
      // Check for paths without baseUrl
      if (opts.paths && !opts.baseUrl) {
        issues.push('paths specified without baseUrl');
      }
      
      // Warn about loose type checking
      if (opts.strict === false) {
        log('warning', 'strict mode is disabled', path);
      }
      
      // Check module/moduleResolution compatibility
      if (opts.module === 'ESNext' && opts.moduleResolution === 'node') {
        issues.push('module: ESNext should use moduleResolution: bundler or nodenext');
      }
    }
    
    if (issues.length > 0) {
      log('error', issues.join('; '), path);
      hasErrors = true;
      return false;
    }
    
    log('success', 'Valid', path);
    return true;
  } catch (err) {
    log('error', `Validation error: ${err.message}`, path);
    hasErrors = true;
    return false;
  }
}

function findTsConfigs(dir, results = []) {
  if (!existsSync(dir)) return results;
  
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip excluded directories
      if (['node_modules', 'dist', 'build', '.next', '.git'].includes(entry.name)) {
        continue;
      }
      
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        findTsConfigs(fullPath, results);
      } else if (entry.name.match(/^tsconfig.*\.json$/)) {
        results.push(fullPath);
      }
    }
  } catch (err) {
    log('warning', `Could not read directory: ${err.message}`, dir);
  }
  
  return results;
}

function checkWorkspacePaths() {
  log('info', 'Checking workspace package paths...');
  
  const baseConfigPath = join(root, 'tsconfig.base.json');
  if (!existsSync(baseConfigPath)) {
    log('warning', 'tsconfig.base.json not found');
    return;
  }
  
  try {
    const content = readFileSync(baseConfigPath, 'utf8');
    const stripped = stripJsonComments(content);
    const baseConfig = JSON.parse(stripped);
    const paths = baseConfig.compilerOptions?.paths || {};
    
    for (const [alias, mappings] of Object.entries(paths)) {
      for (const mapping of mappings) {
        // Skip wildcard patterns - they don't point to specific files
        if (mapping.includes('*')) {
          const baseMapping = mapping.replace('*', '');
          const dirPath = join(root, baseMapping);
          if (existsSync(dirPath)) {
            log('success', `Path mapping "${alias}" pattern is valid`, baseConfigPath);
          } else {
            log('warning', `Path mapping "${alias}" -> "${mapping}" base directory not found`, baseConfigPath);
          }
          continue;
        }
        
        const fullPath = join(root, mapping);
        if (!existsSync(fullPath)) {
          log('error', `Path mapping "${alias}" -> "${mapping}" points to non-existent file`, baseConfigPath);
          hasErrors = true;
        } else {
          log('success', `Path mapping "${alias}" is valid`, baseConfigPath);
        }
      }
    }
  } catch (err) {
    log('error', `Error checking paths: ${err.message}`, baseConfigPath);
    hasErrors = true;
  }
}

function main() {
  console.log('🔍 Validating TypeScript configurations...\n');
  
  // Find all tsconfig files
  log('info', 'Scanning for tsconfig files...');
  const configs = findTsConfigs(root);
  log('info', `Found ${configs.length} configuration files\n`);
  
  // Validate each config
  log('info', 'Validating configuration files...');
  const results = configs.map(validateTsConfig);
  const validCount = results.filter(Boolean).length;
  
  console.log();
  
  // Check workspace paths
  checkWorkspacePaths();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Summary:`);
  console.log(`   Total configs: ${configs.length}`);
  console.log(`   Valid: ${validCount}`);
  console.log(`   Invalid: ${configs.length - validCount}`);
  
  if (hasErrors) {
    console.log('\n❌ Validation failed with errors');
    process.exit(1);
  } else {
    console.log('\n✅ All TypeScript configurations are valid');
    process.exit(0);
  }
}

main();
