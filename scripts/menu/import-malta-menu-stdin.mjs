#!/usr/bin/env node
/*
  Malta Menu Importer (stdin/file)

  - Reads TSV/plain-text menu from a file (argv[2]) or STDIN
  - De-duplicates per bar (normalized name)
  - Skips already-present items per bar
  - Inserts only missing ones into public.restaurant_menu_items

  Usage examples:
    DATABASE_URL=postgresql://... node scripts/menu/import-malta-menu-stdin.mjs data/malta_menu.tsv
    cat data/malta_menu.tsv | DATABASE_URL=... node scripts/menu/import-malta-menu-stdin.mjs
*/

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Client } from 'pg';

function readAllInput() {
  const file = process.argv[2];
  if (file) return fs.readFileSync(path.resolve(file), 'utf8');
  if (!process.stdin.isTTY) return fs.readFileSync(0, 'utf8');
  console.error('Provide input file path as argv[2] or pipe data via STDIN.');
  process.exit(2);
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function normalizeQuotes(s) {
  return s.replace(/[’‘‛ʻ]/g, "'").replace(/[“”]/g, '"');
}

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function normName(s) {
  return normalizeWhitespace(normalizeQuotes(s)).toLowerCase();
}

function parseLine(line) {
  if (!line || !line.trim()) return null;
  if (/^bar\s+name/i.test(line)) return null; // header

  // Prefer TSV split
  let parts = line.split('\t');
  if (parts.length !== 5) {
    // Fallback regex split (barName, uuid, itemName, price, category)
    const m = line.match(/^(.+?)\s+([0-9a-fA-F-]{36})\s+(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s+(.+)$/);
    if (!m) return null;
    parts = [m[1], m[2], m[3], m[4], m[5]];
  }
  const [barName, barIdRaw, itemNameRaw, priceRaw, categoryRaw] = parts;
  const bar_id = (barIdRaw || '').trim();
  if (!UUID_RE.test(bar_id)) return null;
  const name = normalizeWhitespace(normalizeQuotes(itemNameRaw || ''));
  const category = normalizeWhitespace(normalizeQuotes(categoryRaw || ''));
  const price = Number((priceRaw || '').toString().trim());
  if (!Number.isFinite(price)) return null;
  return { bar_name: normalizeWhitespace(barName || ''), bar_id, name, price, category };
}

function dedupeInput(items) {
  const seen = new Map(); // bar_id -> Set(normName)
  const out = [];
  for (const it of items) {
    if (!seen.has(it.bar_id)) seen.set(it.bar_id, new Set());
    const s = seen.get(it.bar_id);
    const key = normName(it.name);
    if (s.has(key)) continue; // drop duplicate within import set for same bar
    s.add(key);
    out.push(it);
  }
  return out;
}

async function main() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL env var.');
    process.exit(2);
  }

  const raw = readAllInput();
  const lines = raw.split('\n');
  const parsed = lines.map(parseLine).filter(Boolean);
  const deduped = dedupeInput(parsed);

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    // Verify bars exist and are in Malta
    const barIds = Array.from(new Set(deduped.map((x) => x.bar_id)));
    const barsRes = await client.query(
      'SELECT id, name, country FROM public.bars WHERE id = ANY($1::uuid[])',
      [barIds]
    );
    const barsById = new Map(barsRes.rows.map((r) => [r.id, r]));
    const missingBars = barIds.filter((id) => !barsById.has(id));
    if (missingBars.length) {
      console.warn(`Warning: ${missingBars.length} bars not found; items for these bars will be skipped.`);
    }
    const allowedBars = new Set(
      barsRes.rows.filter((r) => (r.country || '').toLowerCase() === 'malta').map((r) => r.id)
    );
    const filtered = deduped.filter((it) => allowedBars.has(it.bar_id));

    // Load existing items to avoid duplicates per bar
    const allowList = Array.from(allowedBars);
    const existRes = await client.query(
      'SELECT bar_id, name FROM public.restaurant_menu_items WHERE bar_id = ANY($1::uuid[])',
      [allowList]
    );
    const existingByBar = new Map();
    for (const row of existRes.rows) {
      const { bar_id, name } = row;
      if (!existingByBar.has(bar_id)) existingByBar.set(bar_id, new Set());
      existingByBar.get(bar_id).add(normName(name || ''));
    }

    const toInsert = [];
    for (const it of filtered) {
      const set = existingByBar.get(it.bar_id) || new Set();
      if (set.has(normName(it.name))) continue;
      toInsert.push(it);
    }

    await client.query('BEGIN');
    const batchSize = 200;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      if (batch.length === 0) continue;
      const cols = ['bar_id', 'name', 'category', 'price', 'currency', 'is_available', 'created_by'];
      const values = [];
      const placeholders = batch
        .map((it, idx) => {
          const base = idx * cols.length;
          values.push(it.bar_id, it.name, it.category, it.price, 'EUR', true, 'import-malta-menu');
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
        })
        .join(',');
      const sql = `INSERT INTO public.restaurant_menu_items (${cols.join(',')}) VALUES ${placeholders}`;
      await client.query(sql, values);
      inserted += batch.length;
    }
    await client.query('COMMIT');

    console.log('--- Malta Menu Import Summary ---');
    console.log(`Parsed lines: ${lines.length}`);
    console.log(`Parsed items: ${parsed.length}`);
    console.log(`Unique per bar (input): ${deduped.length}`);
    console.log(`Bars found (Malta): ${new Set(parsed.map((x) => x.bar_id)).size}`);
    console.log(`Already present items skipped: ${filtered.length - toInsert.length}`);
    console.log(`Inserted new items: ${inserted}`);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

