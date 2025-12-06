# 🍽️ Bar Menu Items Upload - START HERE

## 🎯 What This Does

Uploads your CSV menu items data (2,850+ items from 27 bars) to Supabase `bar_menu_items` table.

## ⚡ Quickest Path (3 Commands)

```bash
# 1. Edit Python script with your CSV data
nano complete_menu_upload.py
# (Paste your full CSV into FULL_CSV_DATA variable)

# 2. Generate SQL migration  
python3 complete_menu_upload.py > supabase/migrations/20251206170000_upload_bar_menu_items.sql

# 3. Apply to database
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
     -f supabase/migrations/20251206170000_upload_bar_menu_items.sql
```

Done! ✅

## 🚀 Or Use the Interactive Helper

```bash
./bar_menu_helper.sh
```

The script will guide you through:
1. Choosing CSV file or editing Python script
2. Generating SQL migration
3. Applying to database
4. Verification

## 📂 Your Tools

| File | Purpose | When to Use |
|------|---------|-------------|
| `bar_menu_helper.sh` | Interactive guided setup | **RECOMMENDED** - Easiest! |
| `complete_menu_upload.py` | Python script with embedded CSV | Manual control |
| `upload_menu_to_supabase.sh` | Automated upload from CSV file | Have CSV file ready |

## 📚 Documentation

| File | What's Inside |
|------|---------------|
| `BAR_MENU_ITEMS_SUMMARY.md` | Complete overview & troubleshooting |
| `BAR_MENU_QUICKSTART.md` | Quick reference & examples |
| `BAR_MENU_UPLOAD_GUIDE.md` | Detailed step-by-step guide |

## 🗄️ Database Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20251206160000_create_bar_menu_items.sql` | ✅ Creates table (already exists) |
| `supabase/migrations/20251206170000_upload_bar_menu_items.sql` | ⏳ Uploads data (you generate this) |

## 🎓 CSV Format

Your CSV must have exactly these columns:

```csv
bar name,bar_id,item name,price,category
Zion Reggae Bar,4d514423-222a-4b51-83ed-5202d3bf005b,Americano,1.6,Coffees & Teas
Victoria Gastro Pub,46105fa8-efc7-422a-afa8-a5188eb2f5ed,Aljotta,8.5,Soup
```

## 🔐 Connection Info

```bash
# Database URL
postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres

# PAT Token
sbp_500607f0d078e919aa24f179473291544003a035

# Supabase Project
https://lhbowpbcpwoiparwnwgt.supabase.co
```

## ✅ What Gets Created

### Table: `bar_menu_items`
```sql
- id (UUID)
- bar_id (UUID) → references bars table
- bar_name (TEXT)
- item_name (TEXT)
- price (NUMERIC)
- category (TEXT)
- description (TEXT, optional)
- is_available (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)

UNIQUE constraint: (bar_id, item_name, category)
```

### Helper Functions
```sql
get_bar_menu_items(bar_id) 
get_bar_menu_by_category(bar_id, category)
```

### RLS Policies
- Public can read available items
- Service role has full access

## 🧪 After Upload - Verify

```sql
-- Count items
SELECT bar_name, COUNT(*) FROM bar_menu_items GROUP BY bar_name;

-- Sample query
SELECT * FROM bar_menu_items LIMIT 10;

-- Use helper
SELECT * FROM get_bar_menu_items('4d514423-222a-4b51-83ed-5202d3bf005b');
```

## 🎯 Your Data

From your CSV:
- **27 bars** (Zion Reggae Bar, Victoria Gastro Pub, etc.)
- **~2,850 menu items**
- **200+ categories** (Coffees & Teas, Burgers, Pasta, etc.)
- **Prices**: €0.50 - €100+

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Table doesn't exist | `supabase db push` to create it |
| psql not found | `brew install postgresql` (macOS) |
| Foreign key error | Verify bar_id exists in `bars` table |
| Duplicate error | Normal - UPSERT will update existing items |

## 🔄 Workflow Options

### Option 1: Interactive (Easiest)
```bash
./bar_menu_helper.sh
```

### Option 2: Python Script
```bash
# Edit script with CSV
nano complete_menu_upload.py

# Generate & apply
python3 complete_menu_upload.py > migration.sql
psql "<connection>" -f migration.sql
```

### Option 3: CSV File
```bash
# Save CSV file
# Run automated script
./upload_menu_to_supabase.sh
```

## 📊 Expected Results

After successful upload:
- ✅ ~2,850 rows in `bar_menu_items` table
- ✅ 27 bars with menus
- ✅ Queryable via SQL and helper functions
- ✅ Accessible via Supabase API with RLS
- ✅ Ready for WhatsApp bot integration

## 🎉 Success Checklist

- [ ] Table created (`20251206160000_create_bar_menu_items.sql`)
- [ ] CSV data prepared
- [ ] SQL migration generated (`20251206170000_upload_bar_menu_items.sql`)
- [ ] Migration applied to database
- [ ] Data verified with queries
- [ ] Helper functions tested
- [ ] RLS policies working

## 📞 Next Steps

1. **Run** the upload using one of the methods above
2. **Verify** data in Supabase dashboard
3. **Test** queries and helper functions
4. **Integrate** with your WhatsApp bot
5. **Deploy** to production

---

## 🚀 Let's Go!

Choose your preferred method and start uploading! All tools are ready to use.

**Recommended for first-time users**: Run `./bar_menu_helper.sh`

**For more details**: See `BAR_MENU_ITEMS_SUMMARY.md`
