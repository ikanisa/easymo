#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const dirs = [
  'app/orders/[id]',
  'app/menu/[id]/edit',
  'app/menu/new',
  'app/promos/new'
];

dirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  fs.mkdirSync(fullPath, { recursive: true });
  console.log(`✓ Created: ${dir}`);
});

console.log('\nAll directories created successfully!');
