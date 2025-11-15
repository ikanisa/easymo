# Jobs Menu Item - Deployment Guide

## What This Does

Adds **"Jobs"** as the **first menu item** in the WhatsApp home menu, visible in both:

- 🇷🇼 **Rwanda**
- 🇲🇹 **Malta**

Also extends external job search to include Malta-specific queries.

---

## Quick Deploy (2 minutes)

### Step 1: Run Migrations

```bash
# Add Jobs to WhatsApp menu
supabase db push --include-migrations 20251114232000_add_jobs_to_menu.sql

# Add Malta job categories
supabase db push --include-migrations 20251114232100_malta_job_categories.sql
```

### Step 2: Verify Menu Item

```sql
-- Check Jobs is now first item
SELECT key, label_en, display_order, active_countries, page_number
FROM whatsapp_home_menu_items
WHERE key = 'jobs';
```

**Expected Result**:

```
key  | label_en     | display_order | active_countries | page_number
-----+--------------+---------------+------------------+-------------
jobs | Jobs & Gigs  | 1             | {RW,MT}          | 1
```

### Step 3: Verify Job Sources Config

```sql
-- Check Malta queries added
SELECT
  name,
  source_type,
  jsonb_array_length(config->'queries') as query_count,
  config->'queries'
FROM job_sources
WHERE is_active = true;
```

**Expected**: Should see Rwanda + Malta queries for both Deep Search and SerpAPI.

### Step 4: Test on WhatsApp

Send any message to your WhatsApp Business number. You should see:

```
👋 Welcome to EasyMO!

📱 First Page:
1. 💼 Jobs & Gigs
2. 👤 My Profile
3. 🚗 Nearby Drivers
4. 🚶 Find Passengers
... (up to 9 items)

Reply *2* for next page
```

**Jobs is now the first item!** ✅

---

## What Was Changed

### 1. WhatsApp Menu

- **Added**: `jobs` menu item
- **Position**: Display order 1 (first item, first page)
- **Countries**: Rwanda (RW) + Malta (MT)
- **Icon**: 💼
- **Labels**:
  - English: "Jobs & Gigs"
  - French: "Emplois & Petits Boulots"
  - Kinyarwanda: "Imirimo n'Akazi"

### 2. External Job Sources

**Deep Search Queries (Malta)**:

- One day casual jobs in Valletta Malta
- Part time jobs in Sliema Malta
- Hospitality jobs St Julians Malta
- Delivery driver jobs Malta
- Restaurant waiter jobs Malta

**SerpAPI Queries (Malta)**:

- jobs in Malta
- jobs in Valletta
- jobs in Sliema

### 3. Job Categories (Malta-Specific)

Added 7 new categories:

- **iGaming** 🎰 (major Malta sector)
- **Healthcare** 🏥
- **Maritime** ⚓ (yachting industry)
- **Finance** 💰
- **Bar Staff** 🍺 (hospitality sub-category)
- **Hotel Staff** 🏨
- **Restaurant Manager** 👔

### 4. Category Inference (Enhanced)

Updated auto-categorization to recognize:

- "labour" (British spelling)
- "waitress", "hospitality", "bar staff", "barista"
- "receptionist", "retail"
- "igaming", "gaming", "casino", "betting"
- "healthcare", "nurse", "carer", "medical"

---

## Testing Malta Jobs

### Manual Test via WhatsApp (Malta User)

1. **User sends**: "I'm looking for bar work in Sliema"
2. **AI should**:
   - Detect Malta context
   - Search local + external jobs
   - Return Malta-specific results

3. **Expected response**:

   ```
   📋 Found 5 matching jobs:

   1. 🍺 Bar Staff - St Julians (ONLINE)
      📍 St Julians, Malta
      💰 €8-10/hour
      ✨ 91% match

   2. 🍺 Bartender - Sliema (LOCAL)
      📍 Sliema, Malta
      💰 €9/hour + tips
      ✨ 88% match

   ...
   ```

### Test External Job Ingestion

```bash
# Manually trigger sync
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{}'

# Check Malta jobs imported
supabase db run "
SELECT COUNT(*) as malta_jobs
FROM job_listings
WHERE is_external = true
  AND (location LIKE '%Malta%' OR location LIKE '%Valletta%' OR location LIKE '%Sliema%');
"
```

**Expected**: Should see jobs from Malta sources.

---

## Menu Item Priority Explained

The menu now shows (first page):

1. **💼 Jobs & Gigs** ← NEW!
2. 👤 My Profile
3. 🚗 Nearby Drivers
4. 🚶 Find Passengers
5. 🏍️ Schedule Trip
6. 🛡️ Motor Insurance
7. 💊 Nearby Pharmacies
8. 🍽️ Bars & Restaurants
9. 🛒 Shops & Services

Jobs is **first** because:

- ✅ High user value (income generation)
- ✅ Frequent use case (daily job searches)
- ✅ Cross-country appeal (RW + MT)
- ✅ Simple UX (conversational, no forms)

---

## Monitoring Malta Job Performance

```sql
-- Jobs by country (last 7 days)
SELECT
  CASE
    WHEN location LIKE '%Malta%' OR location LIKE '%Valletta%' OR location LIKE '%Sliema%'
    THEN 'Malta'
    WHEN location LIKE '%Kigali%' OR location LIKE '%Rwanda%'
    THEN 'Rwanda'
    ELSE 'Other'
  END as country,
  COUNT(*) as job_count,
  COUNT(*) FILTER (WHERE is_external = true) as external_count,
  COUNT(*) FILTER (WHERE is_external = false) as local_count
FROM job_listings
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY country;

-- Malta-specific categories performance
SELECT
  category,
  COUNT(*) as job_count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(filled_at, NOW()) - created_at)) / 3600) as avg_hours_to_fill
FROM job_listings
WHERE location LIKE '%Malta%'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY category
ORDER BY job_count DESC;

-- Malta external job sources
SELECT
  js.name,
  COUNT(*) as jobs_found,
  MAX(jl.discovered_at) as last_discovered
FROM job_listings jl
JOIN job_sources js ON jl.source_id = js.id
WHERE jl.is_external = true
  AND jl.location LIKE '%Malta%'
GROUP BY js.name;
```

---

## Common Malta Job Sectors

Based on Malta's economy:

| Sector           | Typical Jobs                             | Keywords                                 |
| ---------------- | ---------------------------------------- | ---------------------------------------- |
| **iGaming**      | Developers, Customer Support, Compliance | "igaming", "casino", "betting"           |
| **Hospitality**  | Waiters, Bar Staff, Hotel Workers        | "restaurant", "hotel", "bar"             |
| **Healthcare**   | Nurses, Carers, Medical Staff            | "nurse", "healthcare", "carer"           |
| **Maritime**     | Crew, Yacht Staff, Marine Engineers      | "yacht", "maritime", "crew"              |
| **Finance**      | Accountants, Analysts, Compliance        | "finance", "banking", "accounting"       |
| **Retail**       | Sales, Shop Assistants                   | "retail", "sales", "shop"                |
| **Construction** | Builders, Electricians, Plumbers         | "construction", "builder", "electrician" |

---

## Troubleshooting

### Menu Item Not Showing

1. **Check menu query**:

```sql
SELECT * FROM whatsapp_home_menu_items WHERE key = 'jobs';
```

2. **Verify feature flag** (if using):

```bash
supabase secrets list | grep FEATURE_JOB_BOARD
```

3. **Check user country**:

```sql
-- Ensure user profile has country set
SELECT phone_number, country FROM profiles WHERE phone_number = '+356...';
```

### No Malta Jobs Appearing

1. **Check job sources active**:

```sql
SELECT name, is_active, config->'queries'
FROM job_sources
WHERE source_type IN ('openai_deep_search', 'serpapi');
```

2. **Verify last sync**:

```sql
SELECT MAX(created_at) as last_sync
FROM job_analytics
WHERE event_type = 'JOB_SOURCES_SYNC_COMPLETE';
```

3. **Manually trigger sync**:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-sources-sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{}'
```

4. **Check logs**:

```bash
supabase functions logs job-sources-sync --tail
```

---

## Cost Impact (Malta Addition)

**Additional monthly cost** for Malta queries:

- **Deep Search**: 5 Malta queries × 30 days × $0.015 = **$2.25/month**
- **SerpAPI**: 3 Malta queries × 30 days × $0.01 = **$0.90/month**
- **Total additional cost**: **~$3.15/month**

**Total system cost** (both countries):

- Rwanda + Malta: **~$68/month** for 1,000 users
- **Per user**: **$0.068/month**

Still very affordable! 💰

---

## Next Steps

Now that Jobs is in the menu:

1. ✅ **Verify menu shows Jobs first**
2. ✅ **Test with Malta phone number** (+356...)
3. ✅ **Monitor Malta job ingestion** (daily sync)
4. ✅ **Track Malta-specific metrics**
5. ✅ **Gather user feedback** (Malta market)
6. ✅ **Optimize queries** based on performance

---

## Related Documentation

- **Main Guide**: `JOB_BOARD_START_HERE.md`
- **Phase 2 Setup**: `docs/JOB_BOARD_PHASE2_QUICKSTART.md`
- **External Jobs**: `supabase/functions/job-sources-sync/README.md`
- **Deployment Checklist**: `docs/JOB_BOARD_DEPLOYMENT_CHECKLIST.md`

---

**Status**: ✅ Ready to Deploy **Deployment Time**: 2 minutes **Impact**: Jobs now first item in
RW + MT **Cost**: +$3.15/month for Malta support

🇷🇼🇲🇹 **Ready to serve both markets!** 🚀
