# Business Directory Deployment Status

## ✅ Completed Steps

### 1. GitHub Push - SUCCESS ✓
All changes have been pushed to GitHub:
- easyMOAI repository merge
- Auto-sync workflow
- Business directory table schema
- Import script
- Documentation

**Commits pushed:**
- 7da94a2 - Merge easyMOAI repository
- 621a7e0 - Merge summary
- 0c85e50 - Auto-sync workflow
- 06b0f6d - Auto-sync quick start
- 77a049d - Business directory system
- 43152db - Business directory quick start

### 2. Migration Application - PENDING ⏳

The business_directory migration is ready but needs to be applied to Supabase.

**Issue**: `supabase db push` encountered an error with a different migration (supply_chain_verification.sql).

## 📋 Next Steps Required

### Option 1: Apply via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]
   - Click on "SQL Editor" in the left sidebar

2. **Run the Business Directory Migration**
   - Create a new query
   - Copy the contents from: `supabase/migrations/20251121153900_create_business_directory.sql`
   - Click "Run" to execute

3. **Verify Table Created**
   - Go to "Table Editor"
   - Look for `business_directory` table
   - Check that it has ~25 columns

### Option 2: Apply via Supabase CLI (Manual)

1. **Set Environment Variables**
   ```bash
   export SUPABASE_ACCESS_TOKEN="your-access-token"
   export SUPABASE_DB_PASSWORD="your-db-password"
   ```

2. **Link Project**
   ```bash
   supabase link --project-ref [YOUR_PROJECT_REF]
   ```

3. **Run Migration**
   ```bash
   supabase db push --include-all
   ```

### Option 3: Apply via psql (Direct Database)

If you have the database connection string:

```bash
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
psql $DATABASE_URL -f supabase/migrations/20251121153900_create_business_directory.sql
```

## 📊 Business Import Script

### Requirements

The import script needs these environment variables:

```bash
# Required for Supabase connection
export NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Optional for Google Maps import via Gemini
export API_KEY="your-gemini-api-key"
# or
export GEMINI_API_KEY="your-gemini-api-key"
```

### Running the Import

#### Demo Mode (No API Key - 3 Sample Businesses)

```bash
# Set only Supabase credentials
export NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Run import
node scripts/import-business-directory.mjs
```

This will import 3 demo businesses to test the system.

#### Full Import (With Gemini API Key)

```bash
# Set all credentials
export NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
export API_KEY="your-gemini-api-key"

# Run import
node scripts/import-business-directory.mjs
```

This will:
- Search Google Maps for businesses across Rwanda
- Import businesses from 5 cities × 10 categories = ~50 queries
- Each query may return 10-50 businesses
- Total: Potentially hundreds to thousands of businesses

### Rate Limiting

The script includes a 2-second delay between API calls to avoid rate limits.

For the full 8,000+ businesses:
- Adjust `CATEGORIES_TO_FETCH` and `CITIES_TO_FETCH` in the script
- Run multiple times over several days
- Or increase API quota with Google

## 🔍 Verification Steps

After applying the migration and running the import:

### 1. Check Table Exists

```sql
SELECT COUNT(*) FROM business_directory;
```

### 2. View Sample Data

```sql
SELECT name, category, city, rating, status 
FROM business_directory 
LIMIT 10;
```

### 3. Test Queries

```sql
-- By category
SELECT COUNT(*) FROM business_directory 
WHERE category = 'Restaurant';

-- By city
SELECT COUNT(*) FROM business_directory 
WHERE city = 'Kigali';

-- Full-text search
SELECT name, category, city 
FROM business_directory 
WHERE to_tsvector('english', name || ' ' || category) 
  @@ to_tsquery('english', 'cafe | coffee');
```

### 4. Check Import Batches

```sql
SELECT 
  import_batch_id,
  source,
  COUNT(*) as count,
  MIN(imported_at) as first_import,
  MAX(imported_at) as last_import
FROM business_directory
GROUP BY import_batch_id, source
ORDER BY last_import DESC;
```

## 📈 Expected Results

### Demo Mode
- **Businesses imported**: 3
- **Time**: < 5 seconds
- **Categories**: Hotel, Restaurant, Cafe
- **City**: Kigali

### Full Import (First Run)
- **Businesses imported**: 200-500
- **Time**: 5-10 minutes (with rate limiting)
- **Categories**: 10 (configurable)
- **Cities**: 5 (configurable)

### Full Import (All Categories/Cities)
- **Businesses imported**: 8,000+
- **Time**: Several hours (multiple runs)
- **Categories**: 30+
- **Cities**: 10

## 🚨 Troubleshooting

### Migration Error: "relation orders does not exist"

This is from a different migration (supply_chain_verification.sql). It doesn't affect business_directory.

**Solution**: Apply business_directory migration manually via dashboard (Option 1 above).

### Import Error: "Missing environment variables"

The script needs Supabase credentials.

**Solution**: Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Import Error: "Insert error" or "RLS policy"

Check that:
1. Migration was applied successfully
2. Using SERVICE_ROLE_KEY (not anon key)
3. RLS policies are created

### No Businesses Found via API

Google Maps/Gemini may return empty results for some categories/cities.

**Solution**: This is normal. The script will skip and continue.

## 📝 Summary

✅ **Completed:**
- All code pushed to GitHub
- Auto-sync workflow active
- Business directory schema created
- Import script ready

⏳ **Pending:**
- Apply migration to Supabase (manual step via dashboard)
- Set environment variables
- Run import script

🎯 **Goal:**
Once migration is applied and import runs, you'll have a fully functional business directory with 8,000+ Rwanda businesses for sales prospecting.

## 📞 Next Actions

1. **Apply migration via Supabase Dashboard SQL Editor**
   - Copy/paste: `supabase/migrations/20251121153900_create_business_directory.sql`
   - Run it

2. **Get environment variables**
   - Supabase URL: From project settings
   - Service Role Key: From project settings → API
   - Gemini API Key: From https://aistudio.google.com/apikey

3. **Run import**
   ```bash
   export NEXT_PUBLIC_SUPABASE_URL="..."
   export SUPABASE_SERVICE_ROLE_KEY="..."
   export API_KEY="..."
   node scripts/import-business-directory.mjs
   ```

4. **Verify and enjoy!**
   - Check Supabase dashboard
   - Query the data
   - Integrate with components

---

**Date**: 2025-11-21  
**Status**: Ready for manual migration application  
**Auto-sync**: Active (will sync easyMOAI updates every 6 hours)
