#!/usr/bin/env node
// Guard to ensure the deferred inventory app is not accidentally included in production builds.
// The inventory web app was removed from the workspace and rebuild work has been deferred.
// This script fails fast if an `inventory-app` package sneaks back into the tree without
// explicitly opting in via ALLOW_INVENTORY_APP=true.

import { existsSync, statSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();
const inventoryDir = resolve(root, 'inventory-app');
const override = process.env.ALLOW_INVENTORY_APP === 'true';

if (override) {
  console.warn('ℹ️  ALLOW_INVENTORY_APP=true detected – skipping deferred inventory app guard.');
  process.exit(0);
}

if (existsSync(inventoryDir) && statSync(inventoryDir).isDirectory()) {
  console.error('\n❌ Inventory app directory detected at ./inventory-app.');
  console.error('   The rebuild has been formally deferred; remove the directory or set ALLOW_INVENTORY_APP=true to opt-in.');
  process.exit(1);
}

console.log('✅ Inventory app is deferred and no ./inventory-app directory was found.');
process.exit(0);
