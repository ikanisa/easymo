#!/bin/bash
# Mark consolidation migrations as applied in local database
# These migrations assume tables exist from earlier migrations

echo "Starting local Supabase..."
supabase start

echo "Marking consolidation migrations as applied..."
psql postgresql://postgres:postgres@localhost:54322/postgres <<SQL
-- Mark migrations as applied without running them
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
('20251208150000', 'consolidate_mobility_tables'),
('20251208160000', 'drop_deprecated_mobility_tables')
ON CONFLICT (version) DO NOTHING;
SQL

echo "✅ Migrations marked as applied"
echo ""
echo "Now run: supabase db pull"
