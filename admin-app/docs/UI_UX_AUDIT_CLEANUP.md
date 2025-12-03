# UI/UX Audit & Cleanup Plan

**Date**: 2025-12-03  
**Scope**: Client Portal (Mobile App) - Full UI/UX Refactoring

## Executive Summary

This document outlines a comprehensive UI/UX audit and cleanup of the EasyMO client portal, focusing on:
1. Removing hardcoded data and moving to Supabase-backed configuration
2. Implementing proper user profile and mobile money setup flows
3. Cleaning up settings screen
4. Refactoring history/transactions page
5. Improving home screen UX with dynamic keyboard and NFC toggle

---

## 1. Countries & Mobile Money Configuration

### Current Issues
- Countries table migration exists in backup but not applied
- Hardcoded currency (RWF) throughout mock data
- No dynamic country/provider selection

### Required Changes

#### 1.1 Apply Countries Migration
Move `backup_20251114_104454/20251113130000_countries_mobile_money.sql` to active migrations with modifications:

```sql
-- Only include supported countries: RW, CD, BI, TZ
INSERT INTO countries (code, name, currency_code, currency_symbol, phone_prefix, mobile_money_provider, mobile_money_brand, ussd_send_to_phone, ussd_pay_merchant, flag_emoji, timezone, sort_order, is_active) VALUES
  ('RW', 'Rwanda', 'RWF', 'FRw', '+250', 'MTN Mobile Money', 'MoMo', '*182*1*1*{phone}*{amount}#', '*182*8*1*{code}*{amount}#', '🇷🇼', 'Africa/Kigali', 1, true),
  ('CD', 'DR Congo', 'CDF', 'FC', '+243', 'Orange Money', 'Orange Money', '*144*1*{phone}*{amount}#', '*144*4*{code}*{amount}#', '🇨🇩', 'Africa/Kinshasa', 2, true),
  ('BI', 'Burundi', 'BIF', 'FBu', '+257', 'Econet EcoCash', 'EcoCash', '*151*1*1*{phone}*{amount}#', '*151*1*2*{phone}*{amount}#', '🇧🇮', 'Africa/Bujumbura', 3, true),
  ('TZ', 'Tanzania', 'TZS', 'TSh', '+255', 'Vodacom M-Pesa', 'M-Pesa', '*150*00*{phone}*{amount}#', '*150*00*{code}*{amount}#', '🇹🇿', 'Africa/Dar_es_Salaam', 4, true);
```

#### 1.2 User Profile Schema Update
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_country_code TEXT DEFAULT 'RW';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS momo_country_code TEXT; -- Can differ from whatsapp_country_code
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS momo_phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS momo_provider TEXT; -- Auto-set based on country
```

---

## 2. User Profile & Mobile Money Setup Flow

### Business Logic
1. User registers with WhatsApp number → `whatsapp_country_code` derived from phone prefix
2. User's profile country = WhatsApp country (e.g., US if +1 number)
3. User adds mobile money number → can select different country (e.g., RW)
4. Mobile money provider is auto-determined by country (one provider per country)
5. SMS permission is OPTIONAL (not required)

### New Screens Required

#### 2.1 Profile Screen (`/client-portal/profile`)
```
┌─────────────────────────────────────┐
│ Profile                             │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 👤 User Avatar                  │ │
│ │ John Doe                        │ │
│ │ +1 555 123 4567 (WhatsApp)      │ │
│ │ 🇺🇸 United States               │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Mobile Money                        │
│ ┌─────────────────────────────────┐ │
│ │ 🇷🇼 Rwanda                       │ │
│ │ +250 788 123 456                │ │
│ │ MTN MoMo                        │ │
│ │ [Edit]                          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [+ Add Mobile Money Number]         │
└─────────────────────────────────────┘
```

#### 2.2 Mobile Money Setup Screen (`/client-portal/momo-setup`)
```
┌─────────────────────────────────────┐
│ Mobile Money Setup                  │
├─────────────────────────────────────┤
│                                     │
│ Select Country                      │
│ ┌─────────────────────────────────┐ │
│ │ 🇷🇼 Rwanda (MTN MoMo)           │ │
│ │ 🇨🇩 DR Congo (Orange Money)     │ │
│ │ 🇧🇮 Burundi (EcoCash)           │ │
│ │ 🇹🇿 Tanzania (M-Pesa)           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Phone Number                        │
│ ┌─────────────────────────────────┐ │
│ │ +250 │ 788 123 456              │ │
│ └─────────────────────────────────┘ │
│ Provider: MTN MoMo (auto-selected)  │
│                                     │
│ [Save Mobile Money Number]          │
└─────────────────────────────────────┘
```

---

## 3. Home Screen Refactoring

### Current Issues
- Static keyboard (always visible)
- Provider selector present (should be removed)
- No NFC toggle

### Required Changes

#### 3.1 Remove Provider Selector
- Provider is determined by user's mobile money country
- No manual selection needed

#### 3.2 Dynamic Keyboard
- Keyboard hidden by default
- Shows when user taps amount input widget
- Auto-focuses on amount field

#### 3.3 Add NFC Writer Toggle
```
┌─────────────────────────────────────┐
│ Home                                │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ NFC Writer    [Toggle ON/OFF]   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Amount to Receive                   │
│ ┌─────────────────────────────────┐ │
│ │        RWF 0                    │ │
│ │   (tap to enter amount)         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Generate QR Code]                  │
│                                     │
│ Recent Transactions                 │
│ ┌─────────────────────────────────┐ │
│ │ ...                             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 4. Settings Screen Cleanup

### Items to REMOVE
- ❌ Developer Options
- ❌ SMS Synchronization settings
- ❌ Open Source License
- ❌ Webhook Configuration (admin-only via EasyMO Admin Panel)

### Items to KEEP/ADD
- ✅ Theme (Dark/Light)
- ✅ Language/Locale
- ✅ Notifications
- ✅ About (app version, support contact)
- ✅ Logout

### New Settings Structure
```
┌─────────────────────────────────────┐
│ Settings                            │
├─────────────────────────────────────┤
│                                     │
│ Account                             │
│ ├─ Profile                          │
│ └─ Mobile Money Setup               │
│                                     │
│ Preferences                         │
│ ├─ Theme (Dark/Light/System)        │
│ ├─ Language                         │
│ └─ Notifications                    │
│                                     │
│ About                               │
│ ├─ App Version                      │
│ ├─ Terms of Service                 │
│ ├─ Privacy Policy                   │
│ └─ Contact Support                  │
│                                     │
│ [Logout]                            │
└─────────────────────────────────────┘
```

---

## 5. History/Transactions Page Refactoring

### Current Issues
- Uses mock data
- No real-time updates
- Limited filtering

### Required Changes
- Connect to Supabase `momo_transactions` table
- Add Realtime subscription for live updates
- Implement proper date grouping (Today, Yesterday, This Week, etc.)
- Add search by payer name/phone
- Add export functionality (CSV)

---

## 6. Webhook Configuration (Admin-Only)

### Important Note
Webhook configuration is NOT available to public users. This is:
- Set up via EasyMO Admin Panel only
- Available to selected merchants on request
- Configured when user's MoMo number is linked to SMS retrieval

### Admin Panel Location
`/momo-terminal/webhook-health` - For admin to configure merchant webhooks

---

## 7. Internationalization (i18n)

### Supported Locales
- `en` - English (default)
- `fr` - French
- `rw` - Kinyarwanda
- `sw` - Swahili

### Implementation
Use `next-intl` or similar for:
- UI labels
- Date/time formatting
- Currency formatting (based on user's MoMo country)
- Error messages

---

## 8. Files to Modify/Create

### New Files
- [ ] `supabase/migrations/20251203150000_countries_supported.sql`
- [ ] `admin-app/app/(panel)/client-portal/profile/page.tsx`
- [ ] `admin-app/app/(panel)/client-portal/momo-setup/page.tsx`
- [ ] `admin-app/lib/countries/countries-service.ts`
- [ ] `admin-app/lib/countries/types.ts`
- [ ] `admin-app/components/client-portal/ProfileCard.tsx`
- [ ] `admin-app/components/client-portal/MomoSetupForm.tsx`
- [ ] `admin-app/components/client-portal/NfcToggle.tsx`
- [ ] `admin-app/components/client-portal/AmountInput.tsx`

### Files to Modify
- [ ] `admin-app/app/(panel)/client-portal/ClientPortalClient.tsx` - Home screen
- [ ] `admin-app/app/(panel)/settings/SettingsClient.tsx` - Cleanup
- [ ] `admin-app/lib/vendor-portal/mock-data.ts` - Remove or deprecate
- [ ] `admin-app/lib/panel-navigation.ts` - Add new routes

### Files to Remove/Deprecate
- [ ] Webhook settings from client portal
- [ ] Developer options from settings
- [ ] SMS sync settings from settings

---

## 9. Implementation Priority

### Phase 1: Database & Core (Day 1)
1. Apply countries migration (RW, CD, BI, TZ only)
2. Update profiles table schema
3. Create countries service

### Phase 2: Profile & MoMo Setup (Day 1-2)
1. Create profile page
2. Create MoMo setup flow
3. Implement country selection with auto-provider

### Phase 3: Home Screen (Day 2)
1. Remove provider selector
2. Add NFC toggle
3. Implement dynamic keyboard
4. Connect to real data

### Phase 4: Settings Cleanup (Day 2)
1. Remove deprecated options
2. Restructure settings
3. Add proper profile/MoMo links

### Phase 5: History Refactoring (Day 3)
1. Connect to Supabase
2. Add Realtime
3. Improve filtering/search

### Phase 6: i18n (Day 3-4)
1. Set up i18n framework
2. Extract strings
3. Add translations

---

## 10. Testing Checklist

- [ ] User can view profile with WhatsApp country
- [ ] User can add MoMo number with different country
- [ ] Provider auto-selects based on country
- [ ] NFC toggle works on home screen
- [ ] Keyboard appears only when tapping amount input
- [ ] Settings shows only relevant options
- [ ] Transactions load from Supabase
- [ ] Real-time updates work
- [ ] Currency formats correctly per country
- [ ] All supported countries (RW, CD, BI, TZ) work correctly
