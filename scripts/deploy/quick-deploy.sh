#!/bin/bash
# Quick commands to deploy manually

# Set credentials
export SUPABASE_ACCESS_TOKEN="sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0"
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
export SUPABASE_PROJECT_REF="lhbowpbcpwoiparwnwgt"

# 1. Deploy database migrations
echo "Deploying database migrations..."
supabase db push --db-url "$DATABASE_URL"

# 2. Link project
echo "Linking to Supabase project..."
supabase link --project-ref "$SUPABASE_PROJECT_REF"

# 3. Deploy edge functions
echo "Deploying edge functions..."
supabase functions deploy wa-webhook --project-ref "$SUPABASE_PROJECT_REF"
supabase functions deploy wa-webhook-unified --project-ref "$SUPABASE_PROJECT_REF"
supabase functions deploy wa-webhook-core --project-ref "$SUPABASE_PROJECT_REF"
supabase functions deploy dlq-processor --project-ref "$SUPABASE_PROJECT_REF"

echo "✓ Deployment complete!"
