#!/usr/bin/env tsx
/**
 * Auto-fix workspace dependencies
 * 
 * Replaces "@easymo/pkg": "*" with "@easymo/pkg": "workspace:*"
 * and "@va/pkg": "*" with "@va/pkg": "workspace:*"
 */

import fs from 'fs/promises';
import { glob } from 'glob';
import path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

async function fixPackageJson(filePath: string): Promise<{ fixed: boolean; changes: string[] }> {
  const content = await fs.readFile(filePath, 'utf-8');
  const pkg: PackageJson = JSON.parse(content);
  
  const changes: string[] = [];
  let modified = false;

  // Fix dependencies
  for (const depType of ['dependencies', 'devDependencies'] as const) {
    const deps = pkg[depType];
    if (!deps) continue;

    for (const [name, version] of Object.entries(deps)) {
      // Only fix internal packages
      if ((name.startsWith('@easymo/') || name.startsWith('@va/')) && version === '*') {
        deps[name] = 'workspace:*';
        changes.push(`  ${depType}.${name}: "*" → "workspace:*"`);
        modified = true;
      }
    }
  }

  if (modified && !DRY_RUN) {
    await fs.writeFile(filePath, JSON.stringify(pkg, null, 2) + '\n');
  }

  return { fixed: modified, changes };
}

async function main() {
  console.log('🔧 Fixing workspace dependencies...\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No files will be modified\n');
  }

  const packageFiles = await glob('**/package.json', {
    ignore: ['**/node_modules/**', '**/.archive/**', '**/dist/**'],
  });

  console.log(`Found ${packageFiles.length} package.json files\n`);

  let fixedCount = 0;
  const results: Array<{ file: string; changes: string[] }> = [];

  for (const file of packageFiles) {
    const { fixed, changes } = await fixPackageJson(file);
    
    if (fixed) {
      fixedCount++;
      results.push({ file, changes });
    }
  }

  if (results.length === 0) {
    console.log('✅ All workspace dependencies already use correct protocol!');
    process.exit(0);
  }

  console.log(`${DRY_RUN ? 'Would fix' : 'Fixed'} ${fixedCount} files:\n`);
  
  for (const { file, changes } of results) {
    console.log(`📦 ${file}`);
    changes.forEach(change => console.log(change));
    console.log();
  }

  if (!DRY_RUN) {
    console.log('\n📝 Next steps:');
    console.log('1. Run: pnpm install --frozen-lockfile');
    console.log('2. Run: bash scripts/verify/workspace-deps.sh');
    console.log('3. Run: pnpm build');
    console.log('4. Commit changes');
  } else {
    console.log('\n💡 Run without --dry-run to apply changes');
  }
}

main().catch(console.error);
