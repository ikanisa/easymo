# My Business - Deployment Commands Reference

**Quick copy-paste commands for deployment**

---

## 🔐 Set Environment Variables First

```bash
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
export DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
export PGPASSWORD="Pq0jyevTlfoa376P"
export PROJECT_REF="lhbowpbcpwoiparwnwgt"
```

---

## 📦 Option 1: Database Only (psql)

```bash
# Apply all migrations in order
psql "$DATABASE_URL" -f supabase/migrations/20251206_001_profile_menu_items.sql
psql "$DATABASE_URL" -f supabase/migrations/20251206_002_get_profile_menu_items_v2.sql
psql "$DATABASE_URL" -f supabase/migrations/20251206_003_user_businesses.sql
psql "$DATABASE_URL" -f supabase/migrations/20251206_004_semantic_business_search.sql
psql "$DATABASE_URL" -f supabase/migrations/20251206_005_menu_enhancements.sql
psql "$DATABASE_URL" -f supabase/migrations/20251206_006_waiter_ai_tables.sql

# Verify
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM profile_menu_items;"
# Expected output: 8

psql "$DATABASE_URL" -c "SELECT proname FROM pg_proc WHERE proname LIKE '%profile_menu%';"
# Expected: get_profile_menu_items_v2
```

---

## 🚀 Option 2: Full Deployment (Supabase CLI)

```bash
# Install CLI (if needed)
brew install supabase/tap/supabase

# Login
supabase login

# Link project
supabase link --project-ref $PROJECT_REF

# Apply migrations
supabase db push

# Deploy functions
supabase functions deploy wa-webhook-profile \
  --project-ref $PROJECT_REF \
  --no-verify-jwt

supabase functions deploy wa-webhook-waiter \
  --project-ref $PROJECT_REF \
  --no-verify-jwt

# Set secrets (replace values)
supabase secrets set \
  GEMINI_API_KEY=your_gemini_key \
  WA_ACCESS_TOKEN=your_wa_token \
  WA_PHONE_NUMBER_ID=your_phone_id \
  WA_VERIFY_TOKEN=your_verify_token \
  SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=your_service_key \
  --project-ref $PROJECT_REF
```

---

## ✅ Verification Commands

### Check Database

```bash
# Check tables exist
psql "$DATABASE_URL" -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'profile_menu_items',
    'user_businesses',
    'menu_upload_requests',
    'waiter_conversations'
  )
ORDER BY table_name;
"
# Expected: 4 rows

# Check RPC functions
psql "$DATABASE_URL" -c "
SELECT proname, pronargs 
FROM pg_proc 
WHERE proname IN (
  'get_profile_menu_items_v2',
  'search_businesses_semantic'
);
"
# Expected: 2 rows

# Check pg_trgm extension
psql "$DATABASE_URL" -c "SELECT * FROM pg_extension WHERE extname = 'pg_trgm';"
# Expected: 1 row

# Test RPC (replace with real user_id)
psql "$DATABASE_URL" -c "
SELECT item_key, title, display_order 
FROM get_profile_menu_items_v2(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'RW',
  'en'
)
ORDER BY display_order;
"
# Expected: Multiple rows with menu items

# Test semantic search
psql "$DATABASE_URL" -c "
SELECT name, similarity_score 
FROM search_businesses_semantic('Bourbon', 'Rwanda', 5);
"
# Expected: Businesses matching "Bourbon"
```

### Check Functions

```bash
# List functions
supabase functions list --project-ref $PROJECT_REF

# Check function status
curl -s "https://lhbowpbcpwoiparwnwgt.functions.supabase.co/" \
  -H "Authorization: Bearer <anon_key>" | jq

# View function logs
supabase functions logs wa-webhook-profile --project-ref $PROJECT_REF
supabase functions logs wa-webhook-waiter --project-ref $PROJECT_REF
```

---

## 🧪 Testing Commands

### Test Profile Menu

```sql
-- Insert test user if needed
INSERT INTO profiles (user_id, full_name, wa_id)
VALUES (
  'test-user-123'::uuid,
  'Test User',
  '250788123456'
)
ON CONFLICT DO NOTHING;

-- Test dynamic menu
SELECT * FROM get_profile_menu_items_v2(
  'test-user-123'::uuid,
  'RW',
  'en'
);
```

### Test Business Search

```sql
-- Search for businesses
SELECT 
  name,
  category_name,
  similarity_score,
  is_claimed
FROM search_businesses_semantic('Bourbon Coffee', 'Rwanda', 10);

-- Expected: List of businesses matching "Bourbon Coffee"
```

### Test Menu Upload Request

```sql
-- Insert test upload request
INSERT INTO menu_upload_requests (
  bar_id,
  user_id,
  media_id,
  media_type,
  processing_status
)
VALUES (
  (SELECT id FROM bars LIMIT 1),
  'test-user-123'::uuid,
  'test-media-123',
  'image',
  'pending'
)
RETURNING *;
```

### Test Waiter Conversation

```sql
-- Create test conversation
INSERT INTO waiter_conversations (
  bar_id,
  visitor_phone,
  messages,
  current_cart,
  status
)
VALUES (
  (SELECT id FROM bars LIMIT 1),
  '250788123456',
  '[{"role": "user", "content": "Hello"}]'::jsonb,
  '{"items": [], "total": 0}'::jsonb,
  'active'
)
RETURNING *;
```

---

## 🔍 Monitoring Queries

```sql
-- Count records in new tables
SELECT 
  'profile_menu_items' as table_name,
  COUNT(*) as row_count
FROM profile_menu_items
UNION ALL
SELECT 'user_businesses', COUNT(*) FROM user_businesses
UNION ALL
SELECT 'menu_upload_requests', COUNT(*) FROM menu_upload_requests
UNION ALL
SELECT 'waiter_conversations', COUNT(*) FROM waiter_conversations;

-- Menu upload stats
SELECT 
  processing_status,
  COUNT(*) as count,
  AVG(item_count) as avg_items
FROM menu_upload_requests
GROUP BY processing_status;

-- Recent conversations
SELECT 
  visitor_phone,
  status,
  (current_cart->>'total')::numeric as cart_total,
  created_at
FROM waiter_conversations
ORDER BY created_at DESC
LIMIT 10;

-- Orders by status
SELECT 
  status,
  COUNT(*) as order_count,
  SUM(total_amount) as total_revenue
FROM orders
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;

-- Business claims today
SELECT 
  COUNT(*) as claims_today
FROM user_businesses
WHERE claimed_at > CURRENT_DATE;
```

---

## 🐛 Troubleshooting Commands

### Reset Tables (if needed)

```sql
-- WARNING: This deletes all data in new tables
TRUNCATE TABLE waiter_conversations CASCADE;
TRUNCATE TABLE menu_upload_requests CASCADE;
TRUNCATE TABLE user_businesses CASCADE;
-- Do NOT truncate profile_menu_items (has seed data)

-- Re-seed profile menu if needed
-- Run: supabase/migrations/20251206_001_profile_menu_items.sql
```

### Drop and Recreate (nuclear option)

```sql
-- WARNING: Complete reset
DROP TABLE IF EXISTS waiter_conversations CASCADE;
DROP TABLE IF EXISTS menu_upload_requests CASCADE;
DROP TABLE IF EXISTS user_businesses CASCADE;
DROP TABLE IF EXISTS profile_menu_items CASCADE;
DROP FUNCTION IF EXISTS get_profile_menu_items_v2;
DROP FUNCTION IF EXISTS search_businesses_semantic;

-- Then re-run all 6 migrations in order
```

### Check Function Deployment

```bash
# Redeploy specific function
supabase functions deploy wa-webhook-profile \
  --project-ref $PROJECT_REF \
  --no-verify-jwt \
  --debug

# Check logs in real-time
supabase functions logs wa-webhook-waiter \
  --project-ref $PROJECT_REF \
  --follow
```

---

## 📊 Performance Monitoring

```sql
-- Slow queries (if enabled)
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%profile_menu%' OR query LIKE '%search_business%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN (
  'profile_menu_items',
  'user_businesses',
  'menu_upload_requests',
  'waiter_conversations',
  'restaurant_menu_items',
  'orders'
)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename IN ('user_businesses', 'waiter_conversations')
ORDER BY idx_scan DESC;
```

---

## 🔐 Security Checks

```sql
-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN (
  'profile_menu_items',
  'user_businesses',
  'menu_upload_requests',
  'waiter_conversations'
);

-- Check function security
SELECT 
  proname,
  prosecdef
FROM pg_proc
WHERE proname IN (
  'get_profile_menu_items_v2',
  'search_businesses_semantic'
);
-- prosecdef should be true (SECURITY DEFINER)
```

---

## 📱 WhatsApp Testing

```bash
# Send test message (via curl)
curl -X POST \
  "https://lhbowpbcpwoiparwnwgt.functions.supabase.co/wa-webhook-profile" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "250788123456",
            "type": "text",
            "text": {"body": "profile"}
          }]
        }
      }]
    }]
  }'

# Check response in function logs
supabase functions logs wa-webhook-profile --project-ref $PROJECT_REF
```

---

## 🎯 One-Line Deployment

```bash
# Complete deployment (requires Supabase CLI)
supabase login && \
supabase link --project-ref lhbowpbcpwoiparwnwgt && \
supabase db push && \
supabase functions deploy wa-webhook-profile --no-verify-jwt && \
supabase functions deploy wa-webhook-waiter --no-verify-jwt && \
echo "✅ Deployment complete!"
```

---

## 📚 Documentation Links

- **Full Guide**: `DEPLOY_MY_BUSINESS_MANUAL.md`
- **Checklist**: `DEPLOYMENT_CHECKLIST_MY_BUSINESS.md`
- **Summary**: `DEPLOYMENT_SUMMARY_MY_BUSINESS.md`
- **Quick Ref**: `QUICK_REF_MY_BUSINESS.md`
- **Architecture**: `MY_BUSINESS_VISUAL_ARCHITECTURE.md`
- **Index**: `MY_BUSINESS_INDEX.md`

---

**Tip**: Save this file as a reference. Copy-paste commands as needed.
