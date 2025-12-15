# Insurance Contacts Added

## Migration Created
**File:** `supabase/migrations/20251215104300_add_insurance_contacts.sql`

## Contacts Added
1. **+250795588248** - Insurance Contact 1
2. **+250796884076** - Insurance Contact 2

## What's Next

### Deploy the Migration
```bash
cd /Users/jeanbosco/workspace/easymo
supabase db push
```

This will add the two insurance contacts to the `admin_contacts` table with:
- `category = 'insurance'`
- `is_active = true`

### Deploy the Updated Function
```bash
supabase functions deploy wa-webhook-core
```

### Test via WhatsApp
Send: **🛡️ Insurance**

**Expected Response:**
```
🛡️ Insurance Services

For insurance inquiries, please contact:

1. Insurance Contact 1
   https://wa.me/250795588248

2. Insurance Contact 2
   https://wa.me/250796884076
```

## Files Modified
- ✅ `supabase/functions/wa-webhook-core/router.ts` - Updated to query admin_contacts dynamically
- ✅ `supabase/migrations/20251215104300_add_insurance_contacts.sql` - Adds the two insurance contacts

## Optional: Update Contact Names
After deployment, you can update the contact names via SQL:

```sql
UPDATE public.admin_contacts
SET name = 'Actual Name Here'
WHERE phone_number = '+250795588248';

UPDATE public.admin_contacts
SET name = 'Another Name Here'
WHERE phone_number = '+250796884076';
```

Or via the admin panel if available.
