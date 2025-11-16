#!/bin/bash
# Fix Next.js 15 async params in all route handlers

set -e

cd /Users/jeanbosco/workspace/easymo-/admin-app

echo "🔧 Fixing Next.js 15 async params..."

# Find all route.ts files with params
files=$(grep -r "params: { id: string" app --include="*.ts" -l)

count=0
for file in $files; do
  echo "  Fixing: $file"
  
  # Backup
  cp "$file" "$file.bak"
  
  # Fix GET handlers
  perl -i -pe 's/export async function GET\(\s*request: Request,\s*\{ params \}: \{ params: \{ ([^}]+) \} \}\s*\)/export async function GET(request: Request, { params }: { params: Promise<{ $1 }> })/g' "$file"
  
  # Fix POST handlers
  perl -i -pe 's/export async function POST\(\s*request: Request,\s*\{ params \}: \{ params: \{ ([^}]+) \} \}\s*\)/export async function POST(request: Request, { params }: { params: Promise<{ $1 }> })/g' "$file"
  
  # Fix PUT handlers  
  perl -i -pe 's/export async function PUT\(\s*request: Request,\s*\{ params \}: \{ params: \{ ([^}]+) \} \}\s*\)/export async function PUT(request: Request, { params }: { params: Promise<{ $1 }> })/g' "$file"
  
  # Fix DELETE handlers
  perl -i -pe 's/export async function DELETE\(\s*request: Request,\s*\{ params \}: \{ params: \{ ([^}]+) \} \}\s*\)/export async function DELETE(request: Request, { params }: { params: Promise<{ $1 }> })/g' "$file"
  
  # Fix PATCH handlers
  perl -i -pe 's/export async function PATCH\(\s*request: Request,\s*\{ params \}: \{ params: \{ ([^}]+) \} \}\s*\)/export async function PATCH(request: Request, { params }: { params: Promise<{ $1 }> })/g' "$file"
  
  # Add await to params usage (simple case)
  perl -i -pe 's/const \{ ([^}]+) \} = params;/const { $1 } = await params;/g' "$file"
  
  count=$((count + 1))
done

echo "✓ Fixed $count files"
echo ""
echo "Backup files created with .bak extension"
echo "If issues occur, restore with: find app -name '*.bak' -exec sh -c 'mv \"{}\" \"\${0%.bak}\"' {} \;"
