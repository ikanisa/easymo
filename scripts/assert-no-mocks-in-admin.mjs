#!/usr/bin/env node
// Guard: disallow mock-data imports in admin-app during production builds
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
if (!isProd) {
  console.log('ℹ️  Skipping mock import guard (NODE_ENV!=production).');
  process.exit(0);
}

const root = process.cwd();
const TARGET_DIRS = [
  join(root, 'admin-app', 'components'),
];

const EXCLUDE_DIRS = new Set([
  join(root, 'admin-app', 'tests'),
  join(root, 'admin-app', '__tests__'),
  join(root, 'admin-app', 'docs'),
]);

const VALID_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function walk(dir, out) {
  if (EXCLUDE_DIRS.has(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const p = join(dir, entry);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      walk(p, out);
    } else if (s.isFile() && VALID_EXT.has(extname(p))) {
      out.push(p);
    }
  }
}

const files = [];
for (const d of TARGET_DIRS) walk(d, files);

const offenders = [];
const importRe = /import\s+[^;]*from\s+['\"][^'\"]*lib\/mock-data['\"];?|require\(\s*['\"][^'\"]*lib\/mock-data['\"]\s*\)/g;

for (const f of files) {
  if (f.endsWith('lib/mock-data.ts')) continue;
  const content = readFileSync(f, 'utf8');
  if (importRe.test(content)) {
    offenders.push(f);
  }
}

if (offenders.length) {
  console.error('\n❌ Build blocked: mock-data imports found in admin-app code (production).');
  for (const f of offenders) console.error(' -', f.replace(root + '/', ''));
  console.error('\nRemove imports from "@/lib/mock-data" to proceed.');
  process.exit(1);
}

console.log('✅ No mock-data imports detected in admin-app for production build.');
process.exit(0);
