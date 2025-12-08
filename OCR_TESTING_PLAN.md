# OCR Domain Testing & Validation Plan

**Date**: 2025-12-08  
**Status**: Testing in Progress

---

## FINDINGS

### Database Schema Mismatch ⚠️

The ported OCR domains expect tables that don't exist in current database:

**Expected by unified-ocr**:
- `menus` (for menu domain)
- `categories` (for menu domain)
- `items` (for menu domain)
- `insurance_certificates` (for vehicle domain)
- `vehicles` (exists ✅ - 1 record)

**Actually in Database**:
- `bar_menu_items` (flat structure, not versioned)
- `menu_categories` (tenant-based, different schema)
- `menu_items` (references menu_categories)
- `bars` (302 active bars ✅)
- `ocr_jobs` (doesn't exist - queue table missing)

---

## IMMEDIATE ACTIONS REQUIRED

### Option 1: Adapt Unified-OCR to Existing Schema (RECOMMENDED)
Update the menu and vehicle domains to work with existing tables.

#### Menu Domain Changes Needed:
```typescript
// Instead of: menus, categories, items
// Use: bar_menu_items (flat structure)

// Change upsertMenuFromExtraction() to:
async function upsertMenuToBarMenuItems(client, job, extraction) {
  const barId = job.bar_id;
  
  // Insert directly into bar_menu_items
  for (const category of extraction.categories) {
    for (const item of category.items) {
      await client.from("bar_menu_items").insert({
        bar_id: barId,
        bar_name: ..., // Get from bars table
        item_name: item.name,
        price: item.price / 100, // Convert from minor to major
        category: category.name,
        description: item.description,
        is_available: true,
      });
    }
  }
}
```

#### Vehicle Domain Changes Needed:
```typescript
// Create insurance_certificates table OR
// Store in vehicle_documents table if it exists

// Check if table exists first
const { data: tables } = await client
  .from('information_schema.tables')
  .select('table_name')
  .eq('table_name', 'insurance_certificates');

if (!tables?.length) {
  // Use alternative storage or create table
}
```

### Option 2: Create Missing Tables
Add migrations for expected tables (more work, cleaner long-term).

---

## TESTING PLAN

### ✅ Phase 1: Insurance Domain (WORKING)
**Status**: Already tested and working in production
- Queue table: `insurance_media_queue` ✅
- Output tables: `insurance_leads`, `insurance_media` ✅
- Tested: Upload certificate → OCR → Admin notify → User bonus ✅

### ⏳ Phase 2: Menu Domain (REQUIRES ADAPTATION)

#### Current Status
- Queue table `ocr_jobs`: **MISSING** ❌
- Output tables: Different schema than expected ⚠️

#### Test Steps
1. **Create ocr_jobs table** (if doesn't exist)
   ```sql
   CREATE TABLE IF NOT EXISTS ocr_jobs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     bar_id UUID NOT NULL REFERENCES bars(id),
     source_file_id TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'queued',
     attempts INT DEFAULT 0,
     error_message TEXT,
     result_path TEXT,
     menu_id UUID,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     last_attempt_at TIMESTAMPTZ
   );
   ```

2. **Adapt menu domain to use bar_menu_items**
3. **Test menu upload**:
   ```bash
   # As bar owner, upload menu image via WhatsApp
   # Should see:
   # - OCR extraction
   # - Items inserted into bar_menu_items
   # - Manager notification
   ```

### ⏳ Phase 3: Vehicle Domain (REQUIRES TABLE)

#### Current Status
- `vehicles` table: **EXISTS** ✅ (1 record)
- `insurance_certificates` table: **MISSING** ❌

#### Test Steps
1. **Create insurance_certificates table** (or use alternative)
   ```sql
   CREATE TABLE IF NOT EXISTS insurance_certificates (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     org_id TEXT NOT NULL,
     vehicle_id UUID REFERENCES vehicles(id),
     policy_no TEXT,
     insurer TEXT,
     effective_from DATE,
     expires_on DATE,
     ocr_raw JSONB,
     ocr_confidence FLOAT,
     verified BOOLEAN DEFAULT FALSE,
     file_url TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Test vehicle certificate upload**:
   ```bash
   POST /unified-ocr
   {
     "domain": "vehicle",
     "profile_id": "...",
     "org_id": "default",
     "vehicle_plate": "RAB123A",
     "file_url": "https://..."
   }
   ```

---

## PERFORMANCE VALIDATION

### Metrics to Check
```sql
-- 1. Error rate (target: <5%)
SELECT 
  COUNT(*) FILTER (WHERE level = 'error') * 100.0 / COUNT(*) as error_rate_pct
FROM edge_function_logs
WHERE function_name = 'unified-ocr'
AND created_at > NOW() - INTERVAL '24 hours';

-- 2. Response time (target: <5s)
SELECT 
  percentile_cont(0.5) WITHIN GROUP (ORDER BY execution_time_ms) as p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_ms
FROM edge_function_logs
WHERE function_name = 'unified-ocr'
AND created_at > NOW() - INTERVAL '24 hours';

-- 3. Queue backlog (target: <100 jobs)
SELECT COUNT(*) FROM insurance_media_queue WHERE status IN ('queued', 'retry');
SELECT COUNT(*) FROM ocr_jobs WHERE status IN ('queued', 'retry');
```

---

## RECOMMENDED IMMEDIATE ACTIONS

### Priority 1: Fix Menu Domain Schema Mismatch
```bash
# 1. Update domains/menu.ts to use bar_menu_items
# 2. Check if ocr_jobs table exists, create if not
# 3. Test with single menu upload
```

### Priority 2: Fix Vehicle Domain Table
```bash
# 1. Check if insurance_certificates exists
# 2. Create table if missing
# 3. Test with single Yellow Card upload
```

### Priority 3: Monitor Insurance Domain
```bash
# Already working, just monitor for 7 days
# Check error rates daily
```

---

## QUICK FIXES NEEDED

### 1. Check & Create Missing Tables
```sql
-- Check what tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ocr_jobs', 'insurance_certificates', 'menus', 'categories', 'items');

-- Create if missing
-- (See CREATE TABLE statements above)
```

### 2. Update Menu Domain
See Option 1 above - adapt to use `bar_menu_items` instead of `menus/categories/items`.

### 3. Test Each Domain
- Insurance: ✅ Already working
- Menu: Adapt + test
- Vehicle: Create table + test

---

## TIMELINE

### Today (2025-12-08)
- [x] Identify schema mismatch issues
- [ ] Create missing tables (ocr_jobs, insurance_certificates)
- [ ] Update menu domain to use bar_menu_items
- [ ] Test menu upload (1 bar)
- [ ] Test vehicle upload (1 certificate)

### Tomorrow (2025-12-09)
- [ ] Monitor error rates
- [ ] Fix any bugs found
- [ ] Test with 5+ menu uploads
- [ ] Test with 3+ vehicle uploads

### Week 1 (2025-12-09 to 2025-12-15)
- [ ] Daily monitoring
- [ ] Confirm <5% error rate
- [ ] Confirm <5s response time
- [ ] Document any issues

### Week 2 (2025-12-16 onwards)
- [ ] If all metrics good: Permanently delete old functions
- [ ] Update documentation
- [ ] Create ops runbook

---

## ROLLBACK TRIGGERS

Delete old functions ONLY if:
- ✅ Error rate <5% for 7 consecutive days
- ✅ Response time <5s (p95) for 7 days
- ✅ No critical bugs reported
- ✅ All 3 domains tested in production
- ✅ Queue backlogs manageable (<100 jobs)

---

## STATUS SUMMARY

| Domain | Code | Tables | Tested | Production Ready |
|--------|------|--------|--------|------------------|
| Insurance | ✅ | ✅ | ✅ | **YES** |
| Menu | ✅ | ⚠️ Schema mismatch | ❌ | **NO** - Needs adaptation |
| Vehicle | ✅ | ❌ Missing table | ❌ | **NO** - Needs table |

**Next Step**: Create missing tables + adapt menu domain to existing schema.
