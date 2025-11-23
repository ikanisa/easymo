# MOMO QR Code Generation Fix

## Issue
When users send a mobile money number (e.g., "0795588248") from the home state, they receive the home menu welcome message instead of the system generating the MOMO QR code.

### Log Evidence
```
DEBUG: handleText body="0795588248" state.key="home"
DEBUG: handleText sending home menu
```

## Root Cause
The `handleMomoText` function in `supabase/functions/wa-webhook/flows/momo/qr.ts` only processes phone numbers when the user state is `STATES.MENU` (`momo_qr_menu`). 

When a user is in the "home" state and sends a phone number, the function returns `false` at line 242, causing the text handler to fall through to the default case which sends the home menu.

## Solution
Modified the `handleMomoText` function to also accept phone numbers when the user state is "home". This allows users to generate MoMo QR codes by simply sending a phone number from anywhere in the app.

### Code Changes
**File:** `supabase/functions/wa-webhook/flows/momo/qr.ts`

**Line 192:** Changed from:
```typescript
case STATES.MENU: {
```

To:
```typescript
case STATES.MENU:
case "home": // Also handle phone numbers from home state
{
```

## Impact
- ✅ Users can now send a MoMo number from the home state and get a QR code
- ✅ No need to navigate to MoMo menu first
- ✅ Better UX - direct intent handling
- ✅ Works with both phone numbers and merchant codes
- ✅ Supports amount in same message (e.g., "0795588248 5000")

## Testing
1. Send a Rwanda phone number (e.g., "0795588248") from home state
2. System should prompt for amount or generate QR if amount included
3. System should NOT show home menu

## Deployment
```bash
# Deploy the updated edge function
supabase functions deploy wa-webhook
```

## Files Modified
- `supabase/functions/wa-webhook/flows/momo/qr.ts` (line 192-194)
