#!/usr/bin/env node
/**
 * Audit TypeScript versions across all packages
 * Ensures all packages use TypeScript 5.5.4
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REQUIRED_VERSION = '5.5.4';

function findPackageJsonFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    
    // Skip node_modules, .archive, dist
    if (item === 'node_modules' || item === '.archive' || item === 'dist' || item === '.git') {
      continue;
    }
    
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      findPackageJsonFiles(fullPath, files);
    } else if (item === 'package.json') {
      files.push(fullPath);
    }
  }
  
  return files;
}

function checkPackageJson(filePath) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const tsVersion = content.devDependencies?.typescript || content.dependencies?.typescript;
  
  return {
    path: filePath,
    version: tsVersion || 'none',
    name: content.name || path.dirname(filePath),
  };
}

console.log('🔍 Auditing TypeScript versions...\n');

const packageFiles = findPackageJsonFiles(process.cwd());
const results = packageFiles.map(checkPackageJson);

// Group by version
const byVersion = results.reduce((acc, r) => {
  if (!acc[r.version]) acc[r.version] = [];
  acc[r.version].push(r);
  return {};
}, {});

let hasErrors = false;

for (const [version, packages] of Object.entries(byVersion)) {
  if (version === 'none') {
    console.log(`⏭️  No TypeScript dependency (${packages.length} packages):`);
    packages.forEach(p => console.log(`   ${p.name}`));
    console.log('');
    continue;
  }
  
  if (version === REQUIRED_VERSION || version === `^${REQUIRED_VERSION}` || version === `~${REQUIRED_VERSION}`) {
    console.log(`✅ TypeScript ${version} (${packages.length} packages)`);
  } else {
    console.log(`❌ TypeScript ${version} (${packages.length} packages) - should be ${REQUIRED_VERSION}:`);
    packages.forEach(p => console.log(`   ${p.path}`));
    hasErrors = true;
  }
}

console.log('\n📊 Summary:');
console.log(`   Total packages: ${results.length}`);
console.log(`   Required version: ${REQUIRED_VERSION}`);

if (hasErrors) {
  console.log('\n❌ Some packages have incorrect TypeScript versions');
  console.log('\nTo fix, run:');
  console.log('  pnpm add -D -w typescript@5.5.4');
  console.log('  # Or update individual packages');
  process.exit(1);
} else {
  console.log('\n✅ All packages use correct TypeScript version');
  process.exit(0);
}
