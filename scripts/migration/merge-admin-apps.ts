#!/usr/bin/env tsx
/**
 * Migration script to merge unique features from admin-app-v2 into admin-app
 * Run with: npx tsx scripts/migration/merge-admin-apps.ts --dry-run
 */

import fs from 'fs/promises';
import path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');

interface MigrationTask {
  name: string;
  source: string;
  destination: string;
}

const tasks: MigrationTask[] = [
  {
    name: 'Zustand stores (if unique)',
    source: 'admin-app-v2/lib/store',
    destination: 'admin-app/lib/store',
  },
  {
    name: 'Recharts components',
    source: 'admin-app-v2/components/charts',
    destination: 'admin-app/components/charts',
  },
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runMigration() {
  console.log('🔄 Starting admin-app merge migration...\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No files will be modified\n');
  }

  for (const task of tasks) {
    console.log(`📦 Processing: ${task.name}`);
    
    const sourceExists = await fileExists(task.source);
    const destExists = await fileExists(task.destination);
    
    if (!sourceExists) {
      console.log(`   ⏭️  Source not found, skipping: ${task.source}`);
      continue;
    }
    
    if (destExists) {
      console.log(`   ⚠️  Destination exists, manual merge needed: ${task.destination}`);
      continue;
    }
    
    if (!DRY_RUN) {
      await fs.cp(task.source, task.destination, { recursive: true });
      console.log(`   ✅ Migrated to: ${task.destination}`);
    } else {
      console.log(`   📋 Would migrate to: ${task.destination}`);
    }
  }
  
  console.log('\n✅ Migration analysis complete');
  
  if (!DRY_RUN) {
    console.log('\n📝 Next steps:');
    console.log('1. Review migrated files');
    console.log('2. Update imports in admin-app');
    console.log('3. Run: pnpm --filter @easymo/admin-app build');
    console.log('4. Run: pnpm --filter @easymo/admin-app test');
    console.log('5. If all passes, delete admin-app-v2 directory');
  }
}

runMigration().catch(console.error);
