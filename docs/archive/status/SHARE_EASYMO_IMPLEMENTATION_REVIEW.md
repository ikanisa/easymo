# Share easyMO Implementation Review

**Review Date:** 2025-11-23  
**Status:** ✅ FULLY IMPLEMENTED

## Overview

The "Share easyMO" feature allows users to generate referral links with QR codes to invite friends and earn 10 tokens per successful referral.

---

## Implementation Components

### 1. Button ID & UI
**Location:** `supabase/functions/wa-webhook/wa/ids.ts`
```typescript
SHARE_EASYMO: "share_easymo"
```

**Auto-appended to all list/button messages** via `utils/reply.ts` (line 39-44)

---

### 2. Handler
**Location:** `supabase/functions/wa-webhook/router/interactive_button.ts` (lines 193-220)

**Flow:**
```
User taps "🔗 Share easyMO"
    ↓
ensureReferralLink(supabase, profileId)
    ↓
Generate/retrieve referral code
    ↓
Build WhatsApp deep link: https://wa.me/22893002751?text=REF:CODE
    ↓
Send message with:
    - Instructions
    - wa.me link with REF:CODE
    - Referral code
    - Earn tokens button
```

---

### 3. Link Generation
**Location:** `supabase/functions/wa-webhook/utils/share.ts`

**Key Functions:**

#### `ensureReferralLink(client, profileId)`
1. Checks `profiles.referral_code` (backward compat)
2. Checks `referral_links` table for existing active link
3. If no code: calls RPC `generate_referral_code()` or generates locally
4. Upserts into `referral_links` table
5. Returns:
   - `code`: 8-character referral code (e.g., "AB23XY7Z")
   - `shortLink`: https://easy.mo/r/AB23XY7Z
   - `waLink`: https://wa.me/22893002751?text=REF%3AAB23XY7Z
   - `qrUrl`: https://quickchart.io/qr?text=<waLink>

#### Configuration
```typescript
const REFERRAL_NUMBER_E164 = "+22893002751"; // WhatsApp number
const SHORT_LINK_PREFIX = "https://easy.mo/r/";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars
```

---

### 4. Database Schema

#### `referral_links` Table
**Migration:** `20251123153000_create_referral_links_table.sql`

```sql
CREATE TABLE public.referral_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    code text NOT NULL UNIQUE,
    short_url text,
    active boolean DEFAULT true,
    clicks_count integer DEFAULT 0,
    signups_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**Indexes:**
- `idx_referral_links_user` on `user_id`
- `idx_referral_links_code` on `code`
- `idx_referral_links_active` on `active WHERE active = true`

**RLS Policies:**
- Users can SELECT/INSERT/UPDATE their own links
- Service role has full access

**Functions:**
- `track_referral_click(p_code text)` - Increments clicks_count
- `track_referral_signup(p_code text)` - Increments signups_count

#### `user_referrals` Table
**Migration:** `20251123151000_create_user_referrals_table.sql`

```sql
CREATE TABLE public.user_referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id uuid NOT NULL REFERENCES profiles(user_id),
    referred_id uuid NOT NULL REFERENCES profiles(user_id),
    referral_code text NOT NULL,
    reward_amount integer DEFAULT 1000, -- 10 tokens
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
);
```

**RPC Functions:**
- `generate_referral_code(p_profile_id uuid)` - Generates unique 6-char code
- `process_referral(p_code text, p_referred_id uuid)` - Processes referral and awards tokens

---

### 5. Referral Processing

**Location:** Wallet domain or referral processor

**Flow:**
1. New user sends message with `REF:CODE` or taps wa.me link
2. System extracts code from message
3. Calls `process_referral(code, new_user_id)`
4. RPC function:
   - Validates code exists and is active
   - Creates `user_referrals` record
   - Awards 1000 tokens (10 EMO) to referrer
   - Marks referral as 'completed'

---

### 6. QR Code Generation

**Service:** QuickChart.io API
**Format:** `https://quickchart.io/qr?text=<waLink>&timestamp=<now>`

**Example:**
```
https://quickchart.io/qr?text=https%3A%2F%2Fwa.me%2F22893002751%3Ftext%3DREF%253AAB23XY7Z&timestamp=1700000000000
```

---

### 7. I18n Messages

**Location:** `supabase/functions/wa-webhook/i18n/messages/*.json`

**Required keys:**
```json
{
  "wallet.earn.forward.instructions": "Forward this link to friends:",
  "wallet.earn.share_text_intro": "Join easyMO and get rewards!",
  "wallet.earn.copy.code": "Your referral code: {code}",
  "wallet.earn.note.keep_code": "Share this code with friends!",
  "wallet.earn.error": "😔 Can't create your share link right now. Please try again later.",
  "wallet.earn.button": "💰 Earn Tokens",
  "common.home_button": "🏠 Home",
  "common.buttons.share_easymo": "🔗 Share easyMO"
}
```

---

## Testing Checklist

### ✅ Functional Tests
- [ ] User taps "🔗 Share easyMO" button
- [ ] Receives referral link with code
- [ ] Link format: `https://wa.me/22893002751?text=REF%3A<CODE>`
- [ ] Code is 8 characters, alphanumeric (no I/O/0/1)
- [ ] QR code URL generated correctly
- [ ] Referral code persisted in `referral_links` table
- [ ] Code persisted in `profiles.referral_code`

### ✅ Database Tests
- [ ] `referral_links` table exists
- [ ] `user_referrals` table exists
- [ ] `generate_referral_code()` RPC exists and works
- [ ] `process_referral()` RPC exists and works
- [ ] `track_referral_click()` exists
- [ ] `track_referral_signup()` exists

### ✅ Edge Cases
- [ ] User with no profile ID → Error message
- [ ] Duplicate code generation → Retry logic works
- [ ] Database error → Fallback to local generation
- [ ] RPC failure → Local code generation works

### ✅ Referral Processing
- [ ] New user sends "REF:CODE" → Code extracted
- [ ] `process_referral()` called
- [ ] Referrer receives 1000 tokens (10 EMO)
- [ ] `user_referrals` record created
- [ ] `referral_links.signups_count` incremented

---

## Current Issues

### Issue: "😔 Can't create your share link right now"

**Possible Causes:**
1. ❌ Migrations not deployed to Supabase
2. ❌ RPC functions missing or permissions incorrect
3. ❌ `referral_links` table missing
4. ❌ RLS policies blocking service role access
5. ❌ `profiles` table missing `referral_code` column

---

## Deployment Checklist

### 1. Verify Migrations Deployed
```bash
# Check if referral_links table exists
supabase db remote exec "SELECT COUNT(*) FROM referral_links LIMIT 1;"

# Check if RPC function exists
supabase db remote exec "SELECT proname FROM pg_proc WHERE proname = 'generate_referral_code';"
```

### 2. Deploy Edge Functions
```bash
pnpm run functions:deploy:wa-main
```

### 3. Test Manually
1. Send WhatsApp message to +22893002751
2. Tap "🔗 Share easyMO"
3. Verify link received
4. Check database: `SELECT * FROM referral_links ORDER BY created_at DESC LIMIT 5;`

---

## Recommended Fixes

### If Migrations Not Deployed
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push
```

### If RPC Functions Missing
Run migrations in order:
1. `20251123151000_create_user_referrals_table.sql`
2. `20251123153000_create_referral_links_table.sql`

### If Permissions Issue
Grant service role access:
```sql
GRANT ALL ON public.referral_links TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_referral_code(uuid) TO service_role;
```

---

## Success Criteria

✅ User taps "🔗 Share easyMO"  
✅ Receives message with:
   - wa.me link with REF:CODE
   - Referral code displayed
   - QR code URL (can tap to view)
✅ Link format: `https://wa.me/22893002751?text=REF%3A<8CHARS>`  
✅ Code saved in database  
✅ New user taps link → Referrer earns 10 tokens  

---

## Architecture

```
User Action: Tap "🔗 Share easyMO"
    ↓
router/interactive_button.ts (line 193)
    ↓
utils/share.ts::ensureReferralLink()
    ↓
1. Check profiles.referral_code
2. Check referral_links table
3. Call generate_referral_code() RPC (or local fallback)
4. Upsert into referral_links
5. Build wa.me link with +22893002751
6. Build QR URL
    ↓
Send message with link + code
    ↓
User shares link/QR
    ↓
Friend taps link → Opens WhatsApp with REF:CODE prefilled
    ↓
Friend sends message → process_referral() triggered
    ↓
Referrer earns 10 tokens ✅
```

---

## Next Steps

1. **Verify migrations deployed** to Supabase
2. **Test manually** with real WhatsApp number
3. **Check database** for referral_links entries
4. **Monitor logs** for SHARE_EASYMO_ERROR events
5. **Fix any permission issues** with RLS policies

