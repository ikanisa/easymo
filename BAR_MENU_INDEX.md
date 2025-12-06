# 🍽️ Bar Menu Upload - Complete Index

## 📖 Read This First

**New to this?** Start here: [`BAR_MENU_START_HERE.md`](BAR_MENU_START_HERE.md)

## 🎯 Quick Access

### Upload Tools (Choose One)

| Tool | Best For | Command |
|------|----------|---------|
| **Interactive Helper** | First-time users | `./bar_menu_helper.sh` |
| **Python Script** | Direct control | `python3 complete_menu_upload.py` |
| **Shell Script** | Have CSV file | `./upload_menu_to_supabase.sh` |

### Documentation

| File | Purpose | When to Read |
|------|---------|--------------|
| [`BAR_MENU_START_HERE.md`](BAR_MENU_START_HERE.md) | Quick start guide | **START HERE** |
| [`BAR_MENU_ITEMS_SUMMARY.md`](BAR_MENU_ITEMS_SUMMARY.md) | Complete overview | Need full details |
| [`BAR_MENU_QUICKSTART.md`](BAR_MENU_QUICKSTART.md) | Quick reference | Need examples |
| [`BAR_MENU_UPLOAD_GUIDE.md`](BAR_MENU_UPLOAD_GUIDE.md) | Step-by-step guide | Detailed walkthrough |
| [`UPLOAD_SUMMARY.txt`](UPLOAD_SUMMARY.txt) | Text summary | Terminal-friendly |

## 🗄️ Database Files

| File | Status | Purpose |
|------|--------|---------|
| `supabase/migrations/20251206160000_create_bar_menu_items.sql` | ✅ Ready | Creates table schema |
| `supabase/migrations/20251206170000_upload_bar_menu_items.sql` | ⏳ Generate | Uploads data (you create) |

## ⚡ Three Ways to Upload

### Method 1: Interactive Helper (Easiest)

```bash
./bar_menu_helper.sh
```

Follow the prompts!

### Method 2: Python Script (Recommended)

```bash
# 1. Edit script
nano complete_menu_upload.py
# Paste CSV into FULL_CSV_DATA

# 2. Generate SQL
python3 complete_menu_upload.py > supabase/migrations/20251206170000_upload_bar_menu_items.sql

# 3. Apply
psql "postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
     -f supabase/migrations/20251206170000_upload_bar_menu_items.sql
```

### Method 3: CSV File

```bash
# 1. Create: bar_menu_items_full.csv
# 2. Run:
./upload_menu_to_supabase.sh
```

## 🔐 Connection Details

```
Database: postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres
PAT:      sbp_500607f0d078e919aa24f179473291544003a035
Project:  https://lhbowpbcpwoiparwnwgt.supabase.co
```

## 📊 Your Data

- **Bars**: ~27 (Zion Reggae Bar, Victoria Gastro Pub, etc.)
- **Items**: ~2,850 menu items
- **Categories**: 200+
- **Prices**: €0.50 - €100+

## ✅ Success Checklist

- [ ] Read `BAR_MENU_START_HERE.md`
- [ ] Choose upload method
- [ ] Prepare CSV data
- [ ] Run upload script
- [ ] Verify with queries
- [ ] Test helper functions
- [ ] Ready for production!

## 🆘 Troubleshooting

| Issue | Solution | Doc |
|-------|----------|-----|
| Table doesn't exist | `supabase db push` | `BAR_MENU_UPLOAD_GUIDE.md` |
| psql not found | `brew install postgresql` | `BAR_MENU_ITEMS_SUMMARY.md` |
| Foreign key error | Verify bar exists | `BAR_MENU_QUICKSTART.md` |
| Need examples | Check verification queries | `BAR_MENU_QUICKSTART.md` |

## 🎓 Example Queries

```sql
-- Count items
SELECT bar_name, COUNT(*) FROM bar_menu_items GROUP BY bar_name;

-- Use helper function
SELECT * FROM get_bar_menu_items('4d514423-222a-4b51-83ed-5202d3bf005b');

-- Get by category
SELECT * FROM get_bar_menu_by_category('4d514423-222a-4b51-83ed-5202d3bf005b', 'Coffees & Teas');
```

## 📁 File Tree

```
/Users/jeanbosco/workspace/easymo/
├── 📜 Scripts (Executable)
│   ├── bar_menu_helper.sh              ⭐ Interactive helper
│   ├── complete_menu_upload.py         ⭐ Python generator
│   └── upload_menu_to_supabase.sh      ⭐ CSV uploader
│
├── 📚 Documentation
│   ├── BAR_MENU_START_HERE.md          → Start here!
│   ├── BAR_MENU_ITEMS_SUMMARY.md       → Full overview
│   ├── BAR_MENU_QUICKSTART.md          → Quick reference
│   ├── BAR_MENU_UPLOAD_GUIDE.md        → Detailed guide
│   ├── UPLOAD_SUMMARY.txt              → Text version
│   └── BAR_MENU_INDEX.md               → This file
│
└── 🗄️ Migrations
    └── supabase/migrations/
        ├── 20251206160000_create_bar_menu_items.sql    ✅ Table schema
        └── 20251206170000_upload_bar_menu_items.sql    ⏳ Data upload
```

## 🚀 Let's Go!

1. **Read**: [`BAR_MENU_START_HERE.md`](BAR_MENU_START_HERE.md)
2. **Choose**: Pick upload method
3. **Run**: Execute your chosen script
4. **Verify**: Check results
5. **Done**: Ready for production! ✅

---

**Everything is ready.** Choose your method and start uploading! 🎉
