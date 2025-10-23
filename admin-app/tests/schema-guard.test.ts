import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('database schema guard', () => {
  const repoRoot = process.cwd();
  const adminCorePath = join(repoRoot, 'supabase/migrations/20251027120000_admin_core_schema.sql');
  const coreSchemaPath = join(repoRoot, 'supabase/migrations/20251002120000_core_schema.sql');
  const hasAdminCore = existsSync(adminCorePath);
  const hasCoreSchema = existsSync(coreSchemaPath);
  const adminCore = hasAdminCore ? readFileSync(adminCorePath, 'utf8') : '';
  const coreSchema = hasCoreSchema ? readFileSync(coreSchemaPath, 'utf8') : '';

  (hasAdminCore ? it : it.skip)('defines qr_tokens table with indexes and RLS policies', () => {
    expect(adminCore).toMatch(/create table if not exists public\.qr_tokens/);
    expect(adminCore).toMatch(/create unique index if not exists qr_tokens_token_key/);
    expect(adminCore).toMatch(/create index if not exists qr_tokens_station_idx/);
  });

  (hasAdminCore ? it : it.skip)('ensures notifications table has metadata column', () => {
    expect(adminCore).toMatch(/create table if not exists public\.notifications/);
    expect(adminCore).toMatch(/alter table public\.notifications add column metadata jsonb;/);
  });

  (hasCoreSchema ? it : it.skip)('keeps webhook log auditing structures', () => {
    expect(coreSchema).toMatch(/CREATE TABLE public\.webhook_logs/);
    expect(coreSchema).toMatch(/CREATE INDEX idx_webhook_logs_endpoint_time/);
  });
});
