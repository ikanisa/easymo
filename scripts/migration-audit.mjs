#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const ALLOWLIST_FILE = path.join(MIGRATIONS_DIR, '.audit_allowlist');

const FORBIDDEN_DIRS = new Set([
  'archive',
  'archived',
  '_archive',
  '.archive',
  '_archived_duplicates',
  '_disabled',
  'backup',
  'old',
  'deprecated',
  'phased',
]);

const IGNORE_DIRS = new Set(['.git', 'node_modules']);

const errors = [];

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_FILE)) return new Set();
  const content = fs.readFileSync(ALLOWLIST_FILE, 'utf8');
  return new Set(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#')),
  );
}

function walkDirs(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    errors.push(`Failed to read directory: ${dir}`);
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (FORBIDDEN_DIRS.has(entry.name)) {
      errors.push(`Forbidden archive directory found: ${path.relative(ROOT, fullPath)}`);
    }

    walkDirs(fullPath);
  }
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    errors.push('Missing supabase/migrations directory');
    return [];
  }

  const entries = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory());
  if (dirs.length > 0) {
    const dirNames = dirs.map((dir) => dir.name).sort();
    errors.push(`Unexpected directories in supabase/migrations: ${dirNames.join(', ')}`);
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function auditMigrations() {
  const allowlist = loadAllowlist();
  walkDirs(ROOT);

  const files = listMigrationFiles();
  if (files.length === 0) {
    errors.push('No migration files found in supabase/migrations');
    return;
  }

  const timestampRegex = /^(\d{14})_.+\.sql$/;
  const timestamps = [];
  const seenTimestamps = new Set();
  const checksumMap = new Map();

  for (const filename of files) {
    const match = filename.match(timestampRegex);
    if (!match) {
      errors.push(`Invalid migration filename (expected YYYYMMDDHHMMSS_name.sql): ${filename}`);
      continue;
    }

    const timestamp = match[1];
    if (seenTimestamps.has(timestamp)) {
      errors.push(`Duplicate migration timestamp detected: ${timestamp}`);
    }
    seenTimestamps.add(timestamp);
    timestamps.push(timestamp);

    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const content = fs.readFileSync(fullPath, 'utf8');

    const checksum = sha256(content);
    const existing = checksumMap.get(checksum) || [];
    existing.push(filename);
    checksumMap.set(checksum, existing);

    if (!allowlist.has(filename)) {
      const lower = content.toLowerCase();
      if (lower.includes('twilio')) {
        errors.push(`Prohibited reference detected (Twilio): ${filename}`);
      }
      if (lower.includes('momo') && lower.includes('api')) {
        errors.push(`Prohibited reference detected (MoMo API): ${filename}`);
      }
      if (content.includes("'rw'") || content.includes('"rw"')) {
        errors.push(`Prohibited UI language reference detected ('rw'): ${filename}`);
      }
    }
  }

  const sorted = [...timestamps].sort();
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1]) {
      errors.push(`Duplicate timestamp in sorted list: ${sorted[i]}`);
    }
  }

  for (const [checksum, names] of checksumMap.entries()) {
    if (names.length > 1) {
      errors.push(`Duplicate migration content detected (${checksum}): ${names.join(', ')}`);
    }
  }

  const skipFiles = [];
  for (const entry of fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.skip')) {
      skipFiles.push(entry.name);
    }
  }
  if (skipFiles.length > 0) {
    errors.push(`.skip files are not allowed: ${skipFiles.join(', ')}`);
  }
}

function main() {
  auditMigrations();

  if (errors.length > 0) {
    console.error('Migration audit failed:\n');
    for (const err of errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log('Migration audit passed.');
}

main();
