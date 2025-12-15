# Insurance Feature - Ready to Deploy

## ✅ What Was Done

### 1. Code Updated
**File:** `supabase/functions/wa-webhook-core/router.ts`
- Changed from `insurance_admin_contacts` → `admin_contacts` table
- Query filters: `category='insurance'` AND `is_active=true`
- Returns ALL active insurance contacts (dynamic, no hardcoding)
- Builds numbered list with WhatsApp links

### 2. Migration Created
**File:** `supabase/migrations/20251215104300_add_insurance_contacts.sql`
- Adds two insurance contacts:
  - **+250795588248** (Insurance Contact 1)
  - **+250796884076** (Insurance Contact 2)

## 🚀 Deploy Now

### Step 1: Deploy Database Migration
```bash
cd /Users/jeanbosco/workspace/easymo
supabase db push
```
This adds the insurance contacts to the database.

### Step 2: Deploy Edge Function
```bash
supabase functions deploy wa-webhook-core
```
This deploys the updated router code.

### Step 3: Test
Send via WhatsApp: **🛡️ Insurance**

**Expected Response:**
```
🛡️ Insurance Services

For insurance inquiries, please contact:

1. Insurance Contact 1
   https://wa.me/250795588248

2. Insurance Contact 2
   https://wa.me/250796884076
```

## 📝 Optional: Update Contact Names

After deployment, you can give the contacts better names:

```sql
UPDATE public.admin_contacts
SET name = 'John Doe - Insurance Lead'
WHERE phone_number = '+250795588248';

UPDATE public.admin_contacts
SET name = 'Jane Smith - Insurance Support'
WHERE phone_number = '+250796884076';
```

## 🔄 Managing Contacts (Future)

### Add New Contact
```sql
INSERT INTO public.admin_contacts (category, phone_number, name, is_active)
VALUES ('insurance', '+250788XXXXXX', 'New Insurance Agent', true);
```

### Disable Contact
```sql
UPDATE public.admin_contacts
SET is_active = false
WHERE phone_number = '+250795588248';
```

### Re-enable Contact
```sql
UPDATE public.admin_contacts
SET is_active = true
WHERE phone_number = '+250795588248';
```

### Remove Contact
```sql
DELETE FROM public.admin_contacts
WHERE phone_number = '+250795588248' AND category = 'insurance';
```

## 📊 Verify Setup

Check contacts in database:
```sql
SELECT * FROM public.admin_contacts 
WHERE category = 'insurance' 
ORDER BY created_at;
```

---

**Ready to deploy!** Run the commands in Step 1 and Step 2 above.
