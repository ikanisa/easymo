# Insurance Admin Contacts Column Fix

## Files to Update

The following files use old schema column names (`contact_value`, `contact_type`) instead of new schema (`destination`, `channel`):

### 1. `supabase/functions/insurance-admin-health/index.ts`
**Lines 109, 116, 185**
- Change: `.select("id, contact_type, contact_value, is_active")`
- To: `.select("id, channel, destination, display_name, is_active")`
- Change: `c.contact_type === "whatsapp" && c.contact_value?.trim()`
- To: `c.channel === "whatsapp" && c.destination?.trim()`

### 2. `supabase/functions/wa-webhook/domains/insurance/ins_handler.ts`
**Line 397**
- Change: `const phone = c.contact_value.replace(/[^0-9]/g, '');`
- To: `const phone = c.destination.replace(/[^0-9]/g, '');`

### 3. `supabase/functions/wa-webhook-mobility/ai-agents/customer-support.ts`
**Line 226**
- Change: `.map((c: any) => \`\${c.display_name}: \${c.contact_value}\`)`
- To: `.map((c: any) => \`\${c.display_name}: \${c.destination}\`)`

### 4. `supabase/functions/wa-webhook-insurance/insurance/claims.ts`
**Lines 406-408, 413, 415**
- Change: `.select("contact_value")`
- To: `.select("destination")`
- Change: `.eq("contact_type", "whatsapp")`
- To: `.eq("channel", "whatsapp")`
- Change: `await sendText(admin.contact_value, adminMessage);`
- To: `await sendText(admin.destination, adminMessage);`
- Change: `console.error("Failed to notify admin:", admin.contact_value, error);`
- To: `console.error("Failed to notify admin:", admin.destination, error);`

### 5. `supabase/functions/wa-webhook-insurance/insurance/ins_handler.ts`
**Lines 544, 559, 574**
- Change: `.select('id, contact_type, contact_value, display_name, is_active')`
- To: `.select('id, channel, destination, display_name, is_active')`
- Change: `String(c.contact_type || '').toLowerCase() === 'whatsapp'`
- To: `String(c.channel || '').toLowerCase() === 'whatsapp'`
- Change: `const phone = c.contact_value.replace(/[^0-9]/g, '');`
- To: `const phone = c.destination.replace(/[^0-9]/g, '');`

### 6. `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_admin_notify_old.ts`
**Lines 437, 439, 450**
- Change: `.select("id, contact_value, display_name")`
- To: `.select("id, destination, display_name")`
- Change: `.eq("contact_type", "whatsapp")`
- To: `.eq("channel", "whatsapp")`
- Change: `waId: normalizeAdminWaId(contact.contact_value ?? "")`
- To: `waId: normalizeAdminWaId(contact.destination ?? "")`

## Quick Fix Script

```bash
# Navigate to supabase functions directory
cd supabase/functions

# Fix all occurrences with sed (Mac/Linux)
find . -type f \( -name "*.ts" -o -name "*.js" \) -exec sed -i '' \
  -e 's/contact_value/destination/g' \
  -e 's/contact_type/channel/g' \
  {} +

# For Linux (remove the '' after -i)
find . -type f \( -name "*.ts" -o -name "*.js" \) -exec sed -i \
  -e 's/contact_value/destination/g' \
  -e 's/contact_type/channel/g' \
  {} +
```

## Database Schema Reference

### Old Schema (DEPRECATED)
```sql
CREATE TABLE insurance_admin_contacts (
  id uuid PRIMARY KEY,
  contact_type text,  -- DEPRECATED: use 'channel'
  contact_value text, -- DEPRECATED: use 'destination'
  display_name text,
  is_active boolean,
  display_order integer
);
```

### New Schema (CURRENT)
```sql
CREATE TABLE insurance_admin_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel public.insurance_admin_channel NOT NULL DEFAULT 'whatsapp'::insurance_admin_channel,
  destination text NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- channel is an enum:
CREATE TYPE public.insurance_admin_channel AS ENUM ('whatsapp', 'sms', 'email', 'phone');
```

## Deployment Steps

1. **Apply fixes to all files** (see list above)
2. **Test locally**:
   ```bash
   # Start Supabase functions
   supabase functions serve wa-webhook-insurance
   
   # Test help request
   curl -X POST http://localhost:54321/functions/v1/wa-webhook-insurance \
     -H "Content-Type: application/json" \
     -d '{"message": {"text": {"body": "help"}}}'
   ```

3. **Deploy updated functions**:
   ```bash
   supabase functions deploy wa-webhook
   supabase functions deploy wa-webhook-insurance  
   supabase functions deploy wa-webhook-mobility
   supabase functions deploy insurance-admin-health
   ```

4. **Verify in production**:
   - Send WhatsApp message: "Help"
   - Should see insurance admin contacts with WhatsApp links
   - Should NOT see database errors about missing columns

## Expected Behavior After Fix

### Before Fix
```
❌ Error: column "contact_value" does not exist
❌ No contacts displayed
❌ Help & Support shows generic error message
```

### After Fix
```
✅ Contacts fetched using 'destination' column
✅ Channel filter uses 'channel' column  
✅ Help & Support displays:

🆘 *Help & Support*

Contact our team for assistance:

• *Insurance Support Team 1*
  https://wa.me/250795588248

• *Insurance Support Team 2*
  https://wa.me/250793094876

_Tap any link above to start chatting on WhatsApp._

Or chat with our AI Sales Agent for immediate help.

[💬 Chat with AI] [🏠 Home]
```

## Testing Checklist

- [ ] Help request shows admin contacts
- [ ] WhatsApp links are clickable
- [ ] No database column errors in logs
- [ ] Insurance admin health check passes
- [ ] Claims notifications sent to admins
- [ ] Customer support agent shows contacts

---

**Status**: Ready for implementation  
**Priority**: P1 (blocks Help & Support feature)  
**Estimated Time**: 15 minutes
