# Cleanup Mobility Intents Cron Job

Automated cleanup of expired mobility intent records to prevent database bloat.

## Configuration

- **Schedule**: Daily at 2:00 AM UTC
- **Retention**: 7 days
- **Target**: `mobility_intents` table

## What It Does

Deletes intent records where:
- `expires_at` < (current_date - 7 days)

This keeps:
- Last 7 days of intent history (for analytics)
- All active/recent intents (not expired)

## Deployment

```bash
# Deploy function
supabase functions deploy cleanup-mobility-intents

# Set up cron schedule (via Supabase Dashboard)
# Navigate to: Database → Cron Jobs → Create Job
# Schedule: 0 2 * * *  (Daily at 2 AM UTC)
# Function: cleanup-mobility-intents
```

## Manual Execution

```bash
# Test locally
supabase functions serve cleanup-mobility-intents

# Call it
curl http://localhost:54321/functions/v1/cleanup-mobility-intents

# Or via production
curl -X POST https://[project-ref].supabase.co/functions/v1/cleanup-mobility-intents \
  -H "Authorization: Bearer [anon-key]"
```

## Monitoring

Check cleanup results:
```sql
SELECT 
  created_at,
  (metadata->>'deleted_count')::int as deleted_count,
  metadata->>'retention_days' as retention_days
FROM system_events
WHERE event_type = 'INTENT_CLEANUP_COMPLETED'
ORDER BY created_at DESC
LIMIT 10;
```

## Expected Behavior

Typical daily cleanup:
- **Low activity**: ~50-100 records deleted
- **Medium activity**: ~200-500 records deleted  
- **High activity**: ~1000-2000 records deleted

If deletion count is 0, it means all intents are < 7 days old (normal for new system).
