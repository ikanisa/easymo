#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC_DIRS = [
  join(ROOT, 'app'),
  join(ROOT, 'components'),
  join(ROOT, 'lib'),
];
const FORBIDDEN_PATTERNS = [
  /__mocks__\//,
  /tests\/__mocks__\//,
  /\/lib\/mock-data\.(t|j)sx?/, // local mock-data helper
  /test-utils\/mock-base/,
];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      walk(p, acc);
    } else if (/\.(t|j)sx?$/.test(entry)) {
      acc.push(p);
    }
  }
  return acc;
}

if (String(process.env.NODE_ENV).toLowerCase() === 'production') {
  const files = SRC_DIRS.flatMap((d) => (statSync(d, { throwIfNoEntry: false }) ? walk(d) : []));
  const offenders = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf-8');
    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.test(text)) {
        offenders.push({ file, pat: String(pat) });
        break;
      }
    }
  }
  if (offenders.length) {
    console.error('\nMock import(s) detected in production build:');
    for (const o of offenders.slice(0, 10)) {
      console.error(` - ${o.file} matches ${o.pat}`);
    }
    if (offenders.length > 10) console.error(` ... and ${offenders.length - 10} more`);
    process.exit(1);
  }
}

console.log('assert-no-mocks-in-admin: OK');

