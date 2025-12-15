# Insurance Service Fix - Dynamic Contact System

## Problem
Insurance feature returns "Insurance services are currently unavailable" because:
- The code was querying `insurance_admin_contacts` table (wrong table)
- Should use the existing `admin_contacts` table with `category='insurance'`
- No insurance contacts configured in `admin_contacts` table

## Root Cause
The router in `supabase/functions/wa-webhook-core/router.ts` was querying the wrong table (`insurance_admin_contacts` instead of `admin_contacts`).

## Solution Applied

### 1. ✅ Updated Router Code
Changed `handleInsuranceAgentRequest()` to:
- Query `admin_contacts` table (not `insurance_admin_contacts`)
- Filter by `category='insurance'` and `is_active=true`
- Return **ALL active contacts** (not just one)
- Build dynamic message with numbered list of contacts

**File Modified:** `supabase/functions/wa-webhook-core/router.ts`

```typescript
// Query admin_contacts for active insurance contacts
const { data: contacts, error } = await supabase
  .from("admin_contacts")
  .select("phone_number, name")
  .eq("category", "insurance")
  .eq("is_active", true)
  .order("created_at", { ascending: true });

// Build message with all insurance contacts
contacts.forEach((contact, index) => {
  const whatsappLink = `https://wa.me/${contact.phone_number.replace(/^\+/, "")}`;
  const displayName = contact.name || `Insurance Contact ${index + 1}`;
  message += `${index + 1}. ${displayName}\n   ${whatsappLink}\n\n`;
});
```

### 2. ⚠️ Required: Add Insurance Contacts to Database

**You MUST add insurance admin contacts via SQL or admin panel:**

#### Option A: Via Supabase SQL Editor
```sql
-- Add insurance contacts to admin_contacts table
INSERT INTO public.admin_contacts (category, phone_number, name, is_active)
VALUES 
  ('insurance', '+250788123456', 'John Doe - Insurance Lead', true),
  ('insurance', '+250788234567', 'Jane Smith - Insurance Support', true),
  ('insurance', '+250788345678', 'Bob Wilson - Insurance Claims', true);

-- Verify
SELECT * FROM public.admin_contacts WHERE category = 'insurance';
```

#### Option B: Via Admin Panel UI (if available)
1. Navigate to Admin Panel → Contacts Management
2. Add new contact:
   - Category: `insurance`
   - Phone Number: `+250788XXXXXX`
   - Name: `Contact Name`
   - Active: `true`

### 3. Database Schema Reference
The `admin_contacts` table schema (from `20251209114500_complete_mobility_schema.sql`):
```sql
CREATE TABLE public.admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_contacts_category ON public.admin_contacts(category);
```

## Testing

### 1. Verify Contacts Exist
```sql
SELECT * FROM public.admin_contacts WHERE category = 'insurance' AND is_active = true;
```

### 2. Test via WhatsApp
Send: `🛡️ Insurance`

**Expected Response (multiple contacts):**
```
🛡️ Insurance Services

For insurance inquiries, please contact:

1. John Doe - Insurance Lead
   https://wa.me/250788123456

2. Jane Smith - Insurance Support
   https://wa.me/250788234567

3. Bob Wilson - Insurance Claims
   https://wa.me/250788345678
```

**Expected Response (no contacts):**
```
Insurance services are currently unavailable. Please try again later.
```

## Dynamic Contact Management

### Add New Insurance Contact
```sql
INSERT INTO public.admin_contacts (category, phone_number, name, is_active)
VALUES ('insurance', '+250788XXXXXX', 'New Insurance Agent', true);
```

### Disable Contact (Temporary)
```sql
UPDATE public.admin_contacts
SET is_active = false
WHERE phone_number = '+250788XXXXXX';
```

### Re-enable Contact
```sql
UPDATE public.admin_contacts
SET is_active = true
WHERE phone_number = '+250788XXXXXX';
```

### Delete Contact (Permanent)
```sql
DELETE FROM public.admin_contacts
WHERE phone_number = '+250788XXXXXX' AND category = 'insurance';
```

## Files Modified
- ✅ `supabase/functions/wa-webhook-core/router.ts` - Updated to query `admin_contacts` table dynamically

## Advantages of This Approach
1. ✅ **No hardcoded numbers** - All contacts managed in database
2. ✅ **Dynamic** - Add/remove contacts without code changes
3. ✅ **Multiple contacts** - Users see all available insurance admins
4. ✅ **Easy management** - Update via SQL or admin panel
5. ✅ **Unified table** - Uses existing `admin_contacts` infrastructure

## Next Steps
1. ✅ Code changes applied (router updated)
2. ⚠️ **ACTION REQUIRED:** Add insurance contacts to `admin_contacts` table
3. Deploy edge function: `supabase functions deploy wa-webhook-core`
4. Test via WhatsApp
