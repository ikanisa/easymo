#!/bin/bash
# Fix Next.js 15 params for all agent API routes

files=(
  "admin-app/app/api/agents/[id]/audit/route.ts"
  "admin-app/app/api/agents/[id]/detail/route.ts"
  "admin-app/app/api/agents/[id]/documents/[docId]/preview/route.ts"
  "admin-app/app/api/agents/[id]/documents/[docId]/route.ts"
  "admin-app/app/api/agents/[id]/documents/embed_all/route.ts"
  "admin-app/app/api/agents/[id]/documents/route.ts"
  "admin-app/app/api/agents/[id]/documents/upload/route.ts"
  "admin-app/app/api/agents/[id]/documents/url/route.ts"
  "admin-app/app/api/agents/[id]/documents/web_search/route.ts"
  "admin-app/app/api/agents/[id]/route.ts"
  "admin-app/app/api/agents/[id]/runs/[runId]/route.ts"
  "admin-app/app/api/agents/[id]/runs/route.ts"
  "admin-app/app/api/agents/[id]/search/route.ts"
  "admin-app/app/api/agents/[id]/tasks/[taskId]/route.ts"
  "admin-app/app/api/agents/[id]/tasks/route.ts"
  "admin-app/app/api/agents/[id]/vectors/stats/route.ts"
  "admin-app/app/api/agents/[id]/versions/[versionId]/publish/route.ts"
  "admin-app/app/api/agents/[id]/versions/[versionId]/route.ts"
  "admin-app/app/api/agents/[id]/versions/route.ts"
)

for file in "${files[@]}"; do
  echo "Fixing $file..."
  
  # Create backup
  cp "$file" "$file.bak"
  
  # Fix: Add await for params destructuring at function start
  # Replace patterns like: const admin = getSupabaseAdminClient();
  # After which we need: const { id } = await context.params; or const { id, runId } = await context.params;
  
  sed -i '' 's/{ params }: { params: Promise</context: { params: Promise</g' "$file"
  
done

echo "Done! Backups created with .bak extension"
