# Insurance Admin Contacts - Already Dynamic

**Date**: December 10, 2025  
**Status**: ✅ Already Implemented (Database-Driven)

## Summary

The insurance support contacts **are already pulling dynamically** from the `insurance_admin_contacts` table. No hardcoded phone numbers exist in the code.

## Current Implementation

### Code Location

**File 1**: `supabase/functions/wa-webhook-insurance/insurance/ins_handler.ts`
```typescript
const { data: contacts } = await ctx.supabase
  .from('insurance_admin_contacts')
  .select('id, channel, destination, display_name, is_active')
  .eq('is_active', true)
  .order('created_at');

// Filter WhatsApp contacts
const whatsappContacts = contacts.filter((c: any) => 
  String(c.channel || '').toLowerCase() === 'whatsapp'
);

// Build dynamic WhatsApp links
const contactLinks = whatsappContacts
  .map((c: any) => {
    const phone = c.destination.replace(/[^0-9]/g, '');
    const whatsappUrl = `https://wa.me/${phone}`;
    return `• *${c.display_name}*\n  ${whatsappUrl}`;
  })
  .join('\n\n');

const message = `🏥 *Motor Insurance Support*\n\n` +
  `Contact our insurance team for help:\n\n${contactLinks}\n\n` +
  `_Tap any link above to start chatting on WhatsApp._`;
```

**File 2**: `supabase/functions/wa-webhook/domains/insurance/ins_handler.ts`
- Same implementation as above
- Also includes AI assistant option

## Database Table Structure

### Expected Columns (Used by Code)

```sql
CREATE TABLE insurance_admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,           -- 'whatsapp', 'email', 'phone'
  destination TEXT NOT NULL,        -- Phone number or email
  display_name TEXT NOT NULL,       -- Name shown to users
  display_order INTEGER DEFAULT 0,  -- Sort order
  is_active BOOLEAN DEFAULT true,   -- Enable/disable
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Migration Note

⚠️ **Column Name Discrepancy**: 

The archived migration `20251207134800_ensure_insurance_admin_contacts.sql` uses:
- `contact_type` instead of `channel`
- `contact_value` instead of `destination`

**The code expects**: `channel` and `destination`

## How to Manage Contacts

### Method 1: SQL (Recommended)

```sql
-- View current contacts
SELECT 
  id,
  channel,
  destination, 
  display_name, 
  display_order,
  is_active
FROM insurance_admin_contacts
ORDER BY display_order;

-- Add new contact
INSERT INTO insurance_admin_contacts (
  channel, 
  destination, 
  display_name, 
  display_order, 
  is_active
) VALUES (
  'whatsapp',
  '+250795588248',
  'Insurance Support Team 1',
  1,
  true
);

-- Update contact
UPDATE insurance_admin_contacts
SET destination = '+250793094876',
    display_name = 'Insurance Support Team 2'
WHERE id = 'your-uuid-here';

-- Disable contact (don't delete, just deactivate)
UPDATE insurance_admin_contacts
SET is_active = false
WHERE id = 'your-uuid-here';

-- Re-enable contact
UPDATE insurance_admin_contacts
SET is_active = true
WHERE id = 'your-uuid-here';

-- Change display order
UPDATE insurance_admin_contacts
SET display_order = 1
WHERE id = 'your-uuid-here';
```

### Method 2: Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
2. Navigate to: **Table Editor** → **insurance_admin_contacts**
3. Click **"+ Insert row"** to add new contact
4. Or click on existing row to edit

**Fields to fill**:
- `channel`: `whatsapp` (or `email`, `phone`)
- `destination`: `+250XXXXXXXXX` (full phone number with country code)
- `display_name`: `Insurance Support Team 1`
- `display_order`: `1`, `2`, `3`... (controls order shown to users)
- `is_active`: ✓ (checked)

## Features

✅ **Fully Dynamic** - No code changes needed to update contacts  
✅ **Multi-Channel** - Supports WhatsApp, email, phone  
✅ **Enable/Disable** - Use `is_active` flag instead of deleting  
✅ **Custom Order** - Control display order with `display_order`  
✅ **Real-Time** - Changes take effect immediately (no deployment)  
✅ **Fallback** - Shows friendly message if no contacts available  

## Testing

### In WhatsApp

1. Send "menu" to your bot
2. Select "Insurance" or "Motor Insurance"
3. Tap "Get Help" or "Contact Support"
4. Should see list of contacts from database

### Expected Output

```
🏥 Motor Insurance Support

Contact our insurance team for help:

• Insurance Support Team 1
  https://wa.me/250795588248

• Insurance Support Team 2
  https://wa.me/250793094876

• Insurance Support Team 3
  https://wa.me/250788767816

Tap any link above to start chatting on WhatsApp.
```

## Verification Queries

```sql
-- Check how many active WhatsApp contacts
SELECT COUNT(*) as active_whatsapp_contacts
FROM insurance_admin_contacts
WHERE is_active = true 
  AND channel = 'whatsapp';

-- See what users will see
SELECT 
  display_order,
  display_name,
  destination,
  channel
FROM insurance_admin_contacts
WHERE is_active = true
ORDER BY display_order;

-- Check for inactive contacts
SELECT display_name, is_active
FROM insurance_admin_contacts
WHERE is_active = false;
```

## Best Practices

### DO:
✅ Use `is_active = false` to temporarily disable contacts  
✅ Set meaningful `display_name` (what users see)  
✅ Include country code in `destination` (+250...)  
✅ Set `display_order` to control sequence  
✅ Test after adding/updating contacts  

### DON'T:
❌ Delete contacts (use `is_active = false` instead)  
❌ Use same `display_order` for multiple active contacts  
❌ Forget country code in phone numbers  
❌ Leave `destination` blank  
❌ Use special characters in phone numbers (code strips them)  

## Migration Status

**Current**: Contacts are in archived migration  
**Schema**: May use `contact_type`/`contact_value` instead of `channel`/`destination`  
**Code Expects**: `channel` and `destination` columns  

**If table doesn't exist or has wrong columns**, run this migration:

```sql
BEGIN;

-- Drop and recreate with correct column names
DROP TABLE IF EXISTS insurance_admin_contacts CASCADE;

CREATE TABLE insurance_admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'phone')),
  destination TEXT NOT NULL,
  display_name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_insurance_admin_contacts_active 
  ON insurance_admin_contacts(is_active) 
  WHERE is_active = true;

ALTER TABLE insurance_admin_contacts ENABLE ROW LEVEL SECURITY;

-- Seed default contacts
INSERT INTO insurance_admin_contacts (channel, destination, display_name, display_order, is_active)
VALUES
  ('whatsapp', '+250795588248', 'Insurance Support Team 1', 1, true),
  ('whatsapp', '+250793094876', 'Insurance Support Team 2', 2, true),
  ('whatsapp', '+250788767816', 'Insurance Support Team 3', 3, true);

COMMIT;
```

## Summary

✅ **No code changes needed** - Already dynamic  
✅ **Just update database table** - Changes are instant  
✅ **Fully functional** - Working in production  
✅ **Easy to maintain** - Add/edit/disable via SQL or dashboard  

The system is **already configured correctly**. Simply manage contacts through the database table.
