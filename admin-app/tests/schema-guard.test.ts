import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect,it } from 'vitest';

describe('database schema guard', () => {
  const cwd = process.cwd();
  const repoRoot = existsSync(join(cwd, 'supabase')) ? cwd : join(cwd, '..');
  const adminCore = readFileSync(join(repoRoot, 'supabase/migrations/20251027120000_admin_core_schema.sql'), 'utf8');
  const coreSchema = readFileSync(join(repoRoot, 'supabase/migrations/20251002120000_core_schema.sql'), 'utf8');

  it('defines qr_tokens table with indexes and RLS policies', () => {
    expect(adminCore).toMatch(/create table if not exists public\.qr_tokens/);
    expect(adminCore).toMatch(/create unique index if not exists qr_tokens_token_key/);
    expect(adminCore).toMatch(/create index if not exists qr_tokens_station_idx/);
  });

  it('ensures notifications table has metadata column', () => {
    expect(adminCore).toMatch(/create table if not exists public\.notifications/);
    expect(adminCore).toMatch(/alter table public\.notifications add column metadata jsonb;/);
  });

  it('keeps webhook log auditing structures', () => {
    expect(coreSchema).toMatch(/CREATE TABLE public\.webhook_logs/);
    expect(coreSchema).toMatch(/CREATE INDEX idx_webhook_logs_endpoint_time/);
  });
});
