#!/usr/bin/env node

/**
 * Phase 3-4 Implementation: Workspace Dependencies Checker
 * Verifies all @easymo/* and @va/* dependencies use workspace:* protocol
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

function findPackageJsonFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    
    // Skip node_modules and .archive
    if (item === 'node_modules' || item === '.archive' || item === '.git') {
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

function checkWorkspaceDeps(pkgPath) {
  const content = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const issues = [];
  
  const checkDeps = (deps, type) => {
    if (!deps) return;
    
    Object.entries(deps).forEach(([name, version]) => {
      const isInternal = name.startsWith('@easymo/') || name.startsWith('@va/');
      const hasWorkspaceProtocol = version.startsWith('workspace:');
      
      if (isInternal && !hasWorkspaceProtocol) {
        issues.push({
          package: content.name || path.basename(path.dirname(pkgPath)),
          dependency: name,
          currentVersion: version,
          type,
        });
      }
    });
  };
  
  checkDeps(content.dependencies, 'dependencies');
  checkDeps(content.devDependencies, 'devDependencies');
  
  return issues;
}

function main() {
  console.log(`${COLORS.blue}🔍 Checking workspace dependencies...${COLORS.reset}\n`);
  
  const rootDir = process.cwd();
  const packageFiles = findPackageJsonFiles(rootDir);
  
  console.log(`Found ${packageFiles.length} package.json files\n`);
  
  let totalIssues = 0;
  const allIssues = [];
  
  packageFiles.forEach(pkgPath => {
    const issues = checkWorkspaceDeps(pkgPath);
    if (issues.length > 0) {
      totalIssues += issues.length;
      allIssues.push({ path: pkgPath, issues });
    }
  });
  
  if (totalIssues === 0) {
    console.log(`${COLORS.green}✅ All workspace dependencies use correct protocol!${COLORS.reset}`);
    process.exit(0);
  }
  
  console.log(`${COLORS.red}❌ Found ${totalIssues} workspace dependency issues:${COLORS.reset}\n`);
  
  allIssues.forEach(({ path, issues }) => {
    console.log(`${COLORS.yellow}📦 ${path}${COLORS.reset}`);
    issues.forEach(issue => {
      console.log(`   ${COLORS.red}✗${COLORS.reset} ${issue.dependency}: "${issue.currentVersion}" (${issue.type})`);
      console.log(`     ${COLORS.green}→ Should be: "workspace:*"${COLORS.reset}`);
    });
    console.log('');
  });
  
  console.log(`${COLORS.yellow}To fix, change in package.json:${COLORS.reset}`);
  console.log(`  "${COLORS.red}@easymo/commons${COLORS.reset}": "${COLORS.red}*${COLORS.reset}"`);
  console.log(`  "${COLORS.green}@easymo/commons${COLORS.reset}": "${COLORS.green}workspace:*${COLORS.reset}"\n`);
  
  process.exit(1);
}

main();
