#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const tmpDir = join(repoRoot, 'supabase', '.tmp');
const diffPath = join(tmpDir, 'drift.sql');
const reportPath = join(tmpDir, 'drift-report.txt');

mkdirSync(tmpDir, { recursive: true });

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.log('Skipping remote drift check: SUPABASE_DB_URL is not configured.');
  writeFileSync(reportPath, 'Remote drift check skipped (SUPABASE_DB_URL not provided).\n');
  process.exit(0);
}

const args = [
  'db',
  'diff',
  '--schema',
  'public',
  '--use-migra',
  '--db-url',
  dbUrl,
  '--file',
  diffPath,
];

console.log(`Running: supabase ${args.join(' ')}`);

const runDiff = () =>
  new Promise((resolve, reject) => {
    const child = spawn('supabase', args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`supabase db diff exited with ${code}`));
      }
    });
  });

try {
  await runDiff();
} catch (error) {
  writeFileSync(reportPath, `Remote drift check failed: ${error.message}\n`);
  console.error(error.message);
  process.exit(1);
}

if (!existsSync(diffPath)) {
  writeFileSync(reportPath, 'Supabase CLI did not produce a diff file. Assuming no drift.\n');
  console.log('No drift detected.');
  process.exit(0);
}

const contents = readFileSync(diffPath, 'utf8');
const trimmed = contents.trim();

const normalized = trimmed.replace(/--.*$/gm, '').trim();

if (normalized.length === 0) {
  writeFileSync(reportPath, 'Remote schema matches migrations (empty diff).\n');
  console.log('No drift detected.');
  process.exit(0);
}

if (/no changes/i.test(trimmed)) {
  writeFileSync(reportPath, 'Remote schema matches migrations (Supabase reported no changes).\n');
  console.log('No drift detected.');
  process.exit(0);
}

writeFileSync(
  reportPath,
  [
    'Supabase reported drift between remote database and migrations. Review diff below:',
    '',
    trimmed,
    '',
  ].join('\n'),
);

console.error('Remote schema drift detected. See supabase/.tmp/drift-report.txt for details.');
process.exit(1);
