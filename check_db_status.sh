#!/bin/bash
set -e

echo "======================================"
echo "Database Status Check"
echo "======================================"
echo ""

# Database connection
DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

echo "1. Checking table counts..."
PGPASSWORD="Pq0jyevTlfoa376P" psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -p 5432 -U postgres -d postgres << 'SQL'
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('bars', 'business', 'profiles', 'trips', 'orders')
ORDER BY tablename;
SQL

echo ""
echo "2. Checking bars table..."
PGPASSWORD="Pq0jyevTlfoa376P" psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -p 5432 -U postgres -d postgres << 'SQL'
SELECT COUNT(*) as total_bars FROM public.bars;
SELECT COUNT(DISTINCT slug) as unique_slugs FROM public.bars;
SQL

echo ""
echo "3. Checking business table..."
PGPASSWORD="Pq0jyevTlfoa376P" psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -p 5432 -U postgres -d postgres << 'SQL'
SELECT COUNT(*) as total_businesses FROM public.business;
SELECT COUNT(DISTINCT name) as unique_names FROM public.business;
SQL

echo ""
echo "4. Checking migration status..."
PGPASSWORD="Pq0jyevTlfoa376P" psql -h db.lhbowpbcpwoiparwnwgt.supabase.co -p 5432 -U postgres -d postgres << 'SQL'
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY inserted_at DESC
LIMIT 10;
SQL

echo ""
echo "======================================"
echo "Status check complete!"
echo "======================================"
