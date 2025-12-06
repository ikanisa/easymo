# My Business Workflow - Manual Deployment Guide

**⚠️ IMPORTANT**: Automated bash execution is currently blocked. Follow these manual steps.

## 🔐 Your Credentials

```bash
SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
DATABASE_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
PROJECT_REF="lhbowpbcpwoiparwnwgt"
```

## 📋 Step-by-Step Deployment

### Option A: Using Supabase Dashboard (Recommended)

#### 1. Apply Database Migrations

Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new

Run these migrations **in order**:

**Migration 1: Profile Menu Items**
```sql
-- Copy contents of: supabase/migrations/20251206_001_profile_menu_items.sql
-- Paste into SQL Editor
-- Click "Run"
```

**Migration 2: Dynamic Menu RPC**
```sql
-- Copy contents of: supabase/migrations/20251206_002_get_profile_menu_items_v2.sql
-- Paste and Run
```

**Migration 3: User Businesses**
```sql
-- Copy contents of: supabase/migrations/20251206_003_user_businesses.sql
-- Paste and Run
```

**Migration 4: Semantic Search**
```sql
-- Copy contents of: supabase/migrations/20251206_004_semantic_business_search.sql
-- Paste and Run
```

**Migration 5: Menu Enhancements**
```sql
-- Copy contents of: supabase/migrations/20251206_005_menu_enhancements.sql
-- Paste and Run
```

**Migration 6: Waiter AI Tables**
```sql
-- Copy contents of: supabase/migrations/20251206_006_waiter_ai_tables.sql
-- Paste and Run
```

#### 2. Deploy Edge Functions

Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions

**Deploy wa-webhook-profile (Updated)**:
1. Click on `wa-webhook-profile`
2. Click "Deploy new version"
3. Code is already in: `supabase/functions/wa-webhook-profile/`
4. Ensure these files are included:
   - `profile/menu_items.ts` (new)
   - `profile/home.ts` (updated)
   - `business/search.ts` (new)
   - `business/add_manual.ts` (new)
   - `bars/index.ts` (new)
   - `bars/menu_upload.ts` (new)
   - `bars/menu_edit.ts` (new)
   - `bars/orders.ts` (new)
   - `router.ts` (updated)

**Deploy wa-webhook-waiter (New Function)**:
1. Click "New function"
2. Name: `wa-webhook-waiter`
3. Upload directory: `supabase/functions/wa-webhook-waiter/`
4. No JWT verification needed

#### 3. Set Environment Secrets

Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/settings/functions

Add these secrets for **wa-webhook-waiter**:
```
GEMINI_API_KEY=<your_gemini_api_key>
WA_ACCESS_TOKEN=<your_whatsapp_token>
WA_PHONE_NUMBER_ID=<your_phone_number_id>
WA_VERIFY_TOKEN=<your_verify_token>
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
```

### Option B: Using Supabase CLI

```bash
# 1. Install Supabase CLI (if not installed)
brew install supabase/tap/supabase

# 2. Login
supabase login

# 3. Link project
supabase link --project-ref lhbowpbcpwoiparwnwgt

# 4. Apply migrations
supabase db push

# 5. Deploy functions
supabase functions deploy wa-webhook-profile \
  --project-ref lhbowpbcpwoiparwnwgt \
  --no-verify-jwt

supabase functions deploy wa-webhook-waiter \
  --project-ref lhbowpbcpwoiparwnwgt \
  --no-verify-jwt

# 6. Set secrets
supabase secrets set GEMINI_API_KEY=your_key \
  WA_ACCESS_TOKEN=your_token \
  WA_PHONE_NUMBER_ID=your_id \
  --project-ref lhbowpbcpwoiparwnwgt
```

### Option C: Using psql (Migrations Only)

```bash
# Set password
export PGPASSWORD="Pq0jyevTlfoa376P"

# Apply each migration
psql "postgresql://postgres:$PGPASSWORD@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -f supabase/migrations/20251206_001_profile_menu_items.sql

psql "postgresql://postgres:$PGPASSWORD@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -f supabase/migrations/20251206_002_get_profile_menu_items_v2.sql

# ... repeat for all 6 migrations
```

## ✅ Verification Steps

### 1. Check Database Tables

Run in SQL Editor:
```sql
-- Check profile menu items
SELECT * FROM profile_menu_items ORDER BY display_order;

-- Check user_businesses table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'user_businesses';

-- Check menu enhancements
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'restaurant_menu_items' 
AND column_name IN ('promotion_price', 'dietary_tags');

-- Check waiter tables
SELECT * FROM information_schema.tables 
WHERE table_name = 'waiter_conversations';
```

Expected: 8 profile menu items, all tables exist.

### 2. Check RPC Function

```sql
-- Test dynamic menu RPC
SELECT * FROM get_profile_menu_items_v2(
  '<some_user_id>'::uuid,
  'RW',
  'en'
);
```

Expected: Returns filtered menu items based on user's businesses.

### 3. Check Edge Functions

```bash
# List deployed functions
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/ \
  -H "Authorization: Bearer <anon_key>"
```

Expected: Both wa-webhook-profile and wa-webhook-waiter listed.

## 🧪 Testing the Implementation

### Test 1: Profile Menu
1. Open WhatsApp
2. Send message to your bot number
3. Navigate to Profile
4. **Expected**: Dynamic menu appears
5. **If user has bar/restaurant**: "My Bars & Restaurants" menu item visible

### Test 2: Business Search
1. Profile → "My Businesses" → "Add Business"
2. Type: "Bourbon Coffee" (or any business name)
3. **Expected**: Search results appear with similarity scores
4. Select a business → Claim it
5. **Expected**: Business linked to your user_id in user_businesses table

### Test 3: Manual Business Addition
1. Profile → "My Businesses" → "Add Manually"
2. Follow wizard: Name → Description → Category → Location
3. **Expected**: New business created and visible in "My Businesses"

### Test 4: Menu Upload (Bar Owner)
1. Profile → "My Bars & Restaurants" → Select venue
2. Tap "Upload Menu"
3. Send photo of menu
4. **Expected**: AI extracts items → Review screen → Save
5. Check database: Items in restaurant_menu_items

### Test 5: Order Management
1. Create test order (as customer)
2. Bar owner → "My Bars & Restaurants" → "View Orders"
3. **Expected**: Order appears with status controls
4. Update status → **Expected**: Customer receives notification

### Test 6: Waiter AI (Advanced)
1. Generate QR code with bar_id deeplink
2. Customer scans QR → Starts conversation
3. Type: "I want a beer"
4. **Expected**: AI suggests menu items → Add to cart → Checkout
5. **Expected**: Payment link generated (MOMO/Revolut)

## 🐛 Troubleshooting

### Migration Errors

**Error**: `relation "profile_menu_items" already exists`
- Solution: Table already created, safe to ignore or drop first

**Error**: `extension "pg_trgm" already exists`
- Solution: Extension already enabled, safe to ignore

**Error**: `function get_profile_menu_items_v2 already exists`
- Solution: Use `CREATE OR REPLACE FUNCTION` (already in migration)

### Function Deployment Errors

**Error**: `Cannot find module`
- Solution: Ensure all imports use correct paths
- Check `import_map.json` is uploaded

**Error**: `GEMINI_API_KEY not defined`
- Solution: Set environment secret via Dashboard or CLI

### Runtime Errors

**Issue**: Menu items not showing
- Check: RPC function deployed correctly
- Check: profile_menu_items table has data
- Check: User has profileId set

**Issue**: OCR not extracting menu
- Check: GEMINI_API_KEY is set correctly
- Check: Image is clear and readable
- Check: Media download from WhatsApp succeeds

**Issue**: Payment links not working
- Check: bars.payment_settings has momo_ussd_code or revolut_link
- Check: Currency is set correctly (RWF vs EUR)

## 📊 Database Queries for Monitoring

```sql
-- Count profile menu items
SELECT COUNT(*) FROM profile_menu_items;
-- Expected: 8

-- Count user-businesses links
SELECT COUNT(*) FROM user_businesses;

-- Count menu items uploaded
SELECT COUNT(*) FROM restaurant_menu_items WHERE ocr_extracted = true;

-- Count menu upload requests
SELECT 
  processing_status,
  COUNT(*) 
FROM menu_upload_requests 
GROUP BY processing_status;

-- Recent waiter conversations
SELECT 
  bar_id,
  visitor_phone,
  status,
  created_at 
FROM waiter_conversations 
ORDER BY created_at DESC 
LIMIT 10;

-- Orders by status
SELECT 
  status,
  COUNT(*),
  SUM(total_amount) as total_revenue
FROM orders
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

## 🎯 Success Criteria

- ✅ All 6 migrations applied without errors
- ✅ Both edge functions deployed
- ✅ Profile menu shows dynamic items
- ✅ Business search returns results
- ✅ Menu upload extracts items
- ✅ Orders can be created and managed
- ✅ Waiter AI responds to messages

## 📞 Support

If you encounter issues:

1. Check logs in Supabase Dashboard → Functions → Logs
2. Verify environment secrets are set
3. Test individual components in SQL Editor
4. Review error messages for specific table/function names

---

**Ready for Production**: Yes  
**Estimated Deployment Time**: 30-45 minutes  
**Complexity**: Medium (multiple migrations + 2 functions)
