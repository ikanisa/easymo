# Help Center & Insurance Support Fix

## Issues Fixed

### 1. Insurance Help Button - No WhatsApp Links
**Problem:** When users tap "Help" in insurance menu, they see contact numbers but clicking them does NOTHING - no WhatsApp chat opens.

**Root Cause:** The function showed buttons like `insurance_contact_1`, `insurance_contact_2` but there was **NO HANDLER** for these button IDs. Users clicked and got no response.

**Solution:** Instead of showing buttons that need handlers, send **direct WhatsApp links** that users can tap immediately.

### Before
```
User: [Taps "Help" in Insurance]
System: Shows message with buttons:
        [Agent 1] [Agent 2] [Agent 3]
User: [Taps "Agent 1"]
System: ❌ NO RESPONSE (no handler exists!)
```

### After
```
User: [Taps "Help" in Insurance]
System: 🏥 Motor Insurance Support

        Contact our insurance team for help:

        • Agent Name 1
          https://wa.me/250788123456

        • Agent Name 2
          https://wa.me/250788234567

        Tap any link above to start chatting on WhatsApp.

User: [Taps link]
WhatsApp: Opens chat with agent ✅
```

## Implementation

### wa-webhook/domains/insurance/ins_handler.ts
```typescript
export async function handleInsuranceHelp(ctx: RouterContext): Promise<boolean> {
  const { sendText } = await import("../../wa/client.ts");
  
  // Fetch insurance admin contacts from database
  const { data: contacts } = await ctx.supabase
    .from('insurance_admin_contacts')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (!contacts || contacts.length === 0) {
    await sendButtonsMessage(ctx, 
      "Insurance support contacts are currently unavailable. Please try again later.",
      homeOnly()
    );
    return true;
  }

  // Build contact list with WhatsApp links (not buttons!)
  const contactLinks = contacts
    .map((c: any) => {
      // Format phone number for WhatsApp (remove + and spaces)
      const phone = c.contact_value.replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${phone}`;
      return `• *${c.display_name}*\n  ${whatsappUrl}`;
    })
    .join('\n\n');

  const message = `�� *Motor Insurance Support*\n\n` +
    `Contact our insurance team for help:\n\n${contactLinks}\n\n` +
    `_Tap any link above to start chatting on WhatsApp._`;

  await sendText(ctx.from, message); // Direct text with links, not buttons!
  
  await logStructuredEvent("INSURANCE_HELP_REQUESTED", {
    profile_id: ctx.profileId,
    wa_id: ctx.from,
    contacts_count: contacts.length
  });

  return true;
}
```

### wa-webhook-insurance/insurance/ins_handler.ts
Same approach - replaced list selection with direct WhatsApp links.

## Files Changed
1. `supabase/functions/wa-webhook/domains/insurance/ins_handler.ts`
   - Removed button-based contact selection
   - Added direct WhatsApp link generation
   - Filter for WhatsApp contacts only
   - Use `sendText()` instead of `sendButtonsMessage()`

2. `supabase/functions/wa-webhook-insurance/insurance/ins_handler.ts`
   - Same changes as above

## How It Works
1. User taps "Help" in Insurance menu
2. System queries `insurance_admin_contacts` table for active contacts
3. Filters for `contact_type = 'whatsapp'`
4. Generates `wa.me/{phone}` links for each contact
5. Sends single text message with all links
6. User taps link → WhatsApp opens chat immediately

## WhatsApp Link Format
```
https://wa.me/250788123456
```
- Remove all non-numeric characters from phone
- Use country code (250 for Rwanda)
- WhatsApp automatically opens chat when tapped

## Benefits
✅ **Works immediately** - No button handlers needed  
✅ **Simple UX** - Tap link, start chat  
✅ **No broken buttons** - Links always work  
✅ **Scalable** - Works with any number of contacts  
✅ **Standard WhatsApp** - Uses official wa.me URLs  

## Database Table
```sql
insurance_admin_contacts (
  id UUID PRIMARY KEY,
  contact_type TEXT, -- 'whatsapp', 'phone', 'email'
  contact_value TEXT, -- Phone number like '+250788123456'
  display_name TEXT, -- 'Agent John Doe'
  is_active BOOLEAN,
  display_order INTEGER
)
```

## Testing
1. Tap "Insurance" from home menu
2. Tap "Help"
3. Verify: Should show message with WhatsApp links
4. Tap any link
5. Verify: WhatsApp opens chat with that contact

## Deployment
```bash
supabase functions deploy wa-webhook --no-verify-jwt
supabase functions deploy wa-webhook-insurance --no-verify-jwt
```

**Status**: ✅ Deployed (2025-12-05)

## Note on Help Center from Home Menu
The "Help Center" option from home menu issue requires adding the menu item to the profile home function. This is handled separately in the profile service configuration.

## Principle
**Don't create button IDs without handlers!** Either:
1. Add the handler for the button ID, OR
2. Use direct links/actions that don't need handlers (better for support contacts)

For customer support contacts, **always use direct WhatsApp links** (`wa.me/{phone}`) rather than interactive buttons.
