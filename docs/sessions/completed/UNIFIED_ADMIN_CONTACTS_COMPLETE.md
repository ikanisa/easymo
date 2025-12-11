# Unified Admin/Support Contacts - Complete Implementation

**Date**: December 10, 2025  
**Status**: ✅ Implemented & Ready to Deploy

## Summary

Converted `insurance_admin_contacts` table into a **unified source of truth** for ALL admin,
support, and contact-related information across the entire repository. Eliminated all hardcoded
phone numbers and placeholder contacts.

## What Changed

### 1. Database Migration (`20251210143000_unify_admin_support_contacts.sql`)

**Added Columns**:

- `category` - Categorizes contacts by purpose:
  - `support` - General help/support contacts
  - `admin_auth` - Admin authentication (who can access admin features)
  - `insurance` - Insurance-specific support
  - `general` - General inquiries
  - `escalation` - Urgent issues
- `priority` - Sorting within category (lower = higher priority)

**Created RPC Function**:

```sql
get_admin_contacts(p_category TEXT, p_channel TEXT)
```

Returns filtered contacts by category and channel.

**Migrated Hardcoded Numbers**:

- `+250788767816` → Admin Team 1 (admin_auth)
- `+35677186193` → Admin Team 2 (admin_auth)
- `+250795588248` → Admin Team 3 (admin_auth)
- `+35699742524` → Admin Team 4 (admin_auth)

### 2. Shared Utility (`_shared/admin-contacts.ts`)

**Functions Created**:

```typescript
// Fetch contacts by category/channel
getAdminContacts(supabase, {
  category?: 'support' | 'admin_auth' | 'insurance' | 'general' | 'escalation',
  channel?: 'whatsapp' | 'email' | 'phone' | 'sms',
  activeOnly?: boolean
}): Promise<AdminContact[]>

// Get admin auth numbers (replaces DEFAULT_ADMIN_NUMBERS)
getAdminAuthNumbers(supabase): Promise<Set<string>>

// Build formatted contact message with WhatsApp links
buildContactMessage(contacts, options): string

// Get support contact for error messages
getSupportContactString(supabase, category): Promise<string>
```

### 3. Files Updated - Admin Authentication

Removed hardcoded `DEFAULT_ADMIN_NUMBERS` array from:

- ✅ `supabase/functions/wa-webhook/flows/admin/auth.ts`
- ✅ `supabase/functions/wa-webhook-mobility/flows/admin/auth.ts`
- ✅ `supabase/functions/_shared/wa-webhook-shared/flows/admin/auth.ts`

**Before**:

```typescript
const DEFAULT_ADMIN_NUMBERS = ["+250788767816", "+35677186193", "+250795588248", "+35699742524"];
```

**After**:

```typescript
import { getAdminAuthNumbers } from "../../../_shared/admin-contacts.ts";

const numbers = await getAdminAuthNumbers(ctx.supabase);
// Fetches from insurance_admin_contacts WHERE category = 'admin_auth'
```

### 4. Files Already Using Table (No Changes Needed)

✅ `supabase/functions/wa-webhook-insurance/insurance/ins_handler.ts`  
✅ `supabase/functions/wa-webhook/domains/insurance/ins_handler.ts`  
✅ `supabase/functions/wa-webhook-core/handlers/help-support.ts`

These files were already fetching from `insurance_admin_contacts` table.

## Database Structure

### Table: `insurance_admin_contacts`

```sql
CREATE TABLE insurance_admin_contacts (
  id UUID PRIMARY KEY,
  channel TEXT NOT NULL,           -- 'whatsapp', 'email', 'phone', 'sms'
  destination TEXT NOT NULL UNIQUE, -- Phone number or email (unique constraint)
  display_name TEXT NOT NULL,      -- Name shown to users
  display_order INTEGER DEFAULT 0, -- Order within same category/priority
  priority INTEGER DEFAULT 100,    -- Lower = higher priority
  category TEXT DEFAULT 'support', -- 'support', 'admin_auth', 'insurance', 'general', 'escalation'
  is_active BOOLEAN DEFAULT true,  -- Enable/disable
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes

```sql
-- Active contacts by category
CREATE INDEX idx_insurance_admin_contacts_category
  ON insurance_admin_contacts(category, is_active)
  WHERE is_active = true;

-- Active contacts general
CREATE INDEX idx_insurance_admin_contacts_active
  ON insurance_admin_contacts(is_active)
  WHERE is_active = true;
```

## Usage Examples

### Admin Authentication

```typescript
import { getAdminAuthNumbers } from "../_shared/admin-contacts.ts";

// Check if user is admin
const adminNumbers = await getAdminAuthNumbers(ctx.supabase);
const isAdmin = adminNumbers.has(normalizedPhone);
```

### Support Contact in Error Message

```typescript
import { getSupportContactString } from "../_shared/admin-contacts.ts";

const supportLink = await getSupportContactString(ctx.supabase, "support");

await sendText(userPhone, `❌ Transfer failed.\n\nContact support: ${supportLink}`);
```

### Show Help/Support Contacts

```typescript
import { getAdminContacts, buildContactMessage } from "../_shared/admin-contacts.ts";

const contacts = await getAdminContacts(ctx.supabase, {
  category: "support",
  channel: "whatsapp",
});

const message = buildContactMessage(contacts, {
  title: "🆘 *Help & Support*",
  includeAI: true,
});

await sendText(userPhone, message);
```

### Insurance-Specific Contacts

```typescript
const insuranceContacts = await getAdminContacts(ctx.supabase, {
  category: "insurance",
  channel: "whatsapp",
});

const message = buildContactMessage(insuranceContacts, {
  title: "🏥 *Motor Insurance Support*",
});
```

## Managing Contacts

### Add New Contact (SQL)

```sql
-- Add support contact
INSERT INTO insurance_admin_contacts
  (channel, destination, display_name, category, priority, display_order, is_active)
VALUES
  ('whatsapp', '+250788999888', 'Support Team Lead', 'support', 10, 1, true);

-- Add admin auth number
INSERT INTO insurance_admin_contacts
  (channel, destination, display_name, category, priority, display_order, is_active)
VALUES
  ('whatsapp', '+250799888777', 'New Admin', 'admin_auth', 10, 5, true);
```

### Update Contact

```sql
UPDATE insurance_admin_contacts
SET display_name = 'Senior Support Team',
    priority = 5
WHERE destination = '+250788999888';
```

### Disable Contact

```sql
UPDATE insurance_admin_contacts
SET is_active = false
WHERE destination = '+250788999888';
```

### View Contacts by Category

```sql
SELECT
  category,
  display_name,
  destination,
  channel,
  priority,
  display_order,
  is_active
FROM insurance_admin_contacts
WHERE is_active = true
ORDER BY category, priority, display_order;
```

## Contact Categories

| Category     | Purpose            | Example Use Cases                  |
| ------------ | ------------------ | ---------------------------------- |
| `support`    | General help       | Error messages, user help requests |
| `admin_auth` | Admin verification | Who can access admin features      |
| `insurance`  | Insurance support  | Motor insurance claims, help       |
| `general`    | General inquiries  | General questions, info            |
| `escalation` | Urgent issues      | Critical failures, emergencies     |

## Priority System

- Lower number = Higher priority
- Contacts sorted by: `priority ASC, display_order ASC`
- Example: priority 1 shows before priority 100

**Suggested Priorities**:

- `1-10` - Critical/urgent contacts
- `10-50` - Primary contacts
- `50-100` - Secondary contacts
- `100+` - Tertiary/fallback contacts

## Benefits

✅ **Single Source of Truth** - All contacts in one table  
✅ **No Hardcoded Numbers** - Everything database-driven  
✅ **Easy Management** - Add/update via SQL or dashboard  
✅ **Real-Time Updates** - Changes take effect immediately  
✅ **Categorized** - Different contacts for different purposes  
✅ **Prioritized** - Control which contacts show first  
✅ **Multi-Channel** - WhatsApp, email, phone, SMS  
✅ **Cached** - 5-minute cache for performance  
✅ **Fallback Safe** - Graceful degradation if no contacts

## Deployment Checklist

- [x] Create migration file
- [x] Create shared utility functions
- [x] Update admin auth files (3 files)
- [x] Document all changes
- [ ] Deploy migration
- [ ] Verify admin numbers migrated correctly
- [ ] Test admin authentication still works
- [ ] Test support contact display
- [ ] Deploy edge functions

## Files Changed Summary

```
Created:
  ✅ supabase/migrations/20251210143000_unify_admin_support_contacts.sql
  ✅ supabase/functions/_shared/admin-contacts.ts

Modified:
  ✅ supabase/functions/wa-webhook/flows/admin/auth.ts
  ✅ supabase/functions/wa-webhook-mobility/flows/admin/auth.ts
  ✅ supabase/functions/_shared/wa-webhook-shared/flows/admin/auth.ts

Already Correct (No Changes):
  ✅ supabase/functions/wa-webhook-insurance/insurance/ins_handler.ts
  ✅ supabase/functions/wa-webhook/domains/insurance/ins_handler.ts
  ✅ supabase/functions/wa-webhook-core/handlers/help-support.ts
```

## Testing

### Verify Migration

```sql
-- Should see 4 admin_auth contacts
SELECT * FROM insurance_admin_contacts WHERE category = 'admin_auth';

-- Test RPC function
SELECT * FROM get_admin_contacts('admin_auth', 'whatsapp');
```

### Test Admin Auth

1. Try accessing admin features with numbers in table
2. Should work for: +250788767816, +35677186193, +250795588248, +35699742524
3. Should NOT work for other numbers

### Test Support Contacts

1. Trigger help request in WhatsApp
2. Should see dynamic contact list
3. Links should be clickable WhatsApp links

## Summary

✅ **Eliminated ALL hardcoded admin/support phone numbers**  
✅ **Unified into single table (insurance_admin_contacts)**  
✅ **Added categorization for different use cases**  
✅ **Created reusable utility functions**  
✅ **Updated all admin authentication to use table**  
✅ **Ready for deployment**

The system is now **100% database-driven** for all admin/support contacts. No more hardcoded numbers
anywhere!
