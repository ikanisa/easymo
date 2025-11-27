#!/bin/bash

echo "🗄️  EasyMO Client PWA - Supabase Setup"
echo "======================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL environment variable not set"
  echo ""
  echo "Set it with:"
  echo "export DATABASE_URL='postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres'"
  exit 1
fi

echo "📋 Running schema.sql..."
psql "$DATABASE_URL" < supabase/schema.sql

if [ $? -eq 0 ]; then
  echo "✅ Schema created successfully"
else
  echo "❌ Schema creation failed"
  exit 1
fi

echo ""
echo "🌱 Running seed.sql..."
psql "$DATABASE_URL" < supabase/seed.sql

if [ $? -eq 0 ]; then
  echo "✅ Seed data inserted successfully"
else
  echo "❌ Seed data insertion failed"
  exit 1
fi

echo ""
echo "🎉 Supabase setup complete!"
echo ""
echo "Test your setup:"
echo "http://localhost:3002/heaven-bar"
