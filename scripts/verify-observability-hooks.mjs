#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const [, , envPathArg] = process.argv;
const envPath = envPathArg ?? 'docs/env/staging.env.example';

let contents;
try {
  contents = readFileSync(envPath, 'utf8');
} catch (error) {
  console.error(`Failed to read env file at ${envPath}: ${error.message}`);
  process.exit(1);
}

const parseEnv = (input) => {
  const map = new Map();
  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!key) continue;
    map.set(key.trim(), rest.join('=').trim());
  }
  return map;
};

const envMap = parseEnv(contents);

const requiredKeys = [
  'LOG_DRAIN_URL',
  'METRICS_DRAIN_URL',
  'TRACES_EXPORTER_URL',
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN',
];

const missing = [];
const empty = [];

for (const key of requiredKeys) {
  if (!envMap.has(key)) {
    missing.push(key);
    continue;
  }
  const value = envMap.get(key);
  if (!value || value === '""') {
    empty.push(key);
  }
}

if (missing.length === 0 && empty.length === 0) {
  console.log(
    `✅ Observability secrets present in ${basename(envPath)}: ${requiredKeys.join(', ')}`
  );
  process.exit(0);
}

const issues = [];
if (missing.length > 0) {
  issues.push(`Missing keys: ${missing.join(', ')}`);
}
if (empty.length > 0) {
  issues.push(`Empty values: ${empty.join(', ')}`);
}

console.error(`Observability env verification failed for ${envPath}: ${issues.join(' | ')}`);
process.exit(1);
