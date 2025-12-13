# Supabase Secrets Cleanup Guide

## Overview

This guide helps you clean up Supabase Edge Function secrets, reducing from **82 secrets to 27 essential ones**.

## 🗑️ Secrets to DELETE

### 1. Duplicates (Keep One Version)

Delete these duplicates and use the standardized version instead:

| Delete | Keep Instead | Reason |
|--------|-------------|---------|
| `SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | Standardized naming |
| `SERVICE_URL` | `SUPABASE_URL` | Standardized naming |
| `WA_SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | Duplicate |
| `VITE_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` | Client-only prefix |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | Security risk |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` | Duplicate |
| `GOOGLE_SEARCH_API_KEY` | `GOOGLE_MAPS_API_KEY` | If same key |

**Total to delete: 7 duplicates**

---

### 2. Waiter/Menu/OCR Related (Feature Deprecated)

Delete all menu and OCR-related secrets:

```
❌ MENU_MEDIA_BUCKET
❌ OCR_RESULT_BUCKET
❌ OCR_MAX_ATTEMPTS
❌ OCR_QUEUE_SCAN_LIMIT
❌ OCR_MAX_MENU_CATEGORIES
❌ OCR_MAX_MENU_ITEMS
❌ INSURANCE_OCR_METRICS_WEBHOOK_URL
❌ INSURANCE_OCR_METRICS_TOKEN
❌ INSURANCE_MEDIA_BUCKET
```

**Total to delete: 9 secrets**

---

### 3. Cart/Order Reminders (Feature Not Used)

Delete all cart and order reminder secrets:

```
❌ CART_REMINDER_CRON
❌ CART_REMINDER_MINUTES
❌ CART_REMINDER_BATCH_SIZE
❌ ORDER_PENDING_REMINDER_LANGUAGE
❌ ORDER_PENDING_REMINDER_CRON
❌ ORDER_PENDING_REMINDER_CRON_ENABLED
❌ ORDER_PENDING_REMINDER_MINUTES
❌ ORDER_PENDING_REMINDER_BATCH_SIZE
```

**Total to delete: 8 secrets**

---

### 4. Voucher System (Not in Simplified System)

```
❌ VOUCHER_SIGNING_SECRET
❌ VOUCHERS_BUCKET
```

**Total to delete: 2 secrets**

---

### 5. Build/Dev Tools (Shouldn't be in Edge Functions)

```
❌ TURBO_CACHE
❌ TURBO_REMOTE_ONLY
❌ TURBO_RUN_SUMMARY
❌ TURBO_DOWNLOAD_LOCAL_ENABLED
❌ VITE_SUPABASE_PROJECT_ID
❌ VITE_API_BASE
```

**Total to delete: 6 secrets**

---

### 6. Unused/Deprecated Secrets

```
❌ ADMIN_TOKEN (use EASYMO_ADMIN_TOKEN instead)
❌ ADMIN_ACCESS_CREDENTIALS
❌ ADMIN_SESSION_SECRET_FALLBACK
❌ ADMIN_FLOW_WA_ID
❌ BRIDGE_SHARED_SECRET
❌ MOMO_SMS_HMAC_SECRET
❌ KYC_SIGNED_URL_TTL_SECONDS
❌ DEEPLINK_SIGNING_SECRET
❌ BROKER_APP_BASE_URL
❌ ALERT_WEBHOOK_URL
❌ NOTIFY_WORKER_LEASE_SECONDS
❌ NOTIFY_MAX_RETRIES
❌ NOTIFY_BACKOFF_BASE_SECONDS
❌ NOTIFY_MAX_BACKOFF_SECONDS
❌ NOTIFY_DEFAULT_DELAY_SECONDS
❌ WALLET_API_KEY
❌ SIGNATURE_SECRET
❌ SERPAPI_KEY
❌ FEATURE_AGENT_ALL
❌ FEATURE_AGENT_UNIFIED_SYSTEM
```

**Total to delete: 20 secrets**

---

## ✅ Secrets to KEEP (27 Essential)

### Core Supabase (4 secrets)

| Secret | Purpose | Required |
|--------|---------|----------|
| `SUPABASE_URL` | Database URL | ✅ Yes |
| `SUPABASE_ANON_KEY` | Public key for client | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key for backend | ✅ Yes |
| `SUPABASE_DB_URL` | Direct DB connection | ✅ Yes |

---

### WhatsApp (7 secrets)

| Secret | Purpose | Required |
|--------|---------|----------|
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp API token | ✅ Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone ID | ✅ Yes |
| `WHATSAPP_PHONE_NUMBER_E164` | Phone number format | ✅ Yes |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification | ✅ Yes |
| `WHATSAPP_APP_SECRET` | Signature verification | ✅ Yes |
| `WHATSAPP_TEMPLATE_NAMESPACE` | Template namespace | ✅ Yes |
| `META_WABA_BUSINESS_ID` | Business ID | ✅ Yes |

---

### AI/LLM (4 secrets)

| Secret | Purpose | Required |
|--------|---------|----------|
| `OPENAI_API_KEY` | GPT API calls | ✅ Yes |
| `OPENAI_ORG_ID` | Organization ID | ✅ Yes |
| `OPENAI_PROJECT_ID` | Project ID | ✅ Yes |
| `GEMINI_API_KEY` | Gemini AI backup | ✅ Yes |

---

### Google Services (2 secrets)

| Secret | Purpose | Required |
|--------|---------|----------|
| `GOOGLE_MAPS_API_KEY` | Geocoding & maps | ✅ Yes |
| `GOOGLE_SEARCH_CX` | Search engine ID | ✅ Yes |

---

### Security (3 secrets)

| Secret | Purpose | Required |
|--------|---------|----------|
| `QR_SALT` | QR code generation | ✅ Yes |
| `QR_TOKEN_SECRET` | QR token signing | ✅ Yes |
| `EASYMO_ADMIN_TOKEN` | Admin authentication | ✅ Yes |

---

### Templates (3 secrets)

| Secret | Purpose | Required |
|--------|---------|----------|
| `WA_INSURANCE_ADMIN_TEMPLATE` | Insurance notifications | ✅ Yes |
| `WA_DRIVER_NOTIFY_TEMPLATE` | Driver notifications | ✅ Yes |
| `WA_TEMPLATE_LANG` | Template language | ✅ Yes |

---

### Feature Flags (2 secrets)

| Secret | Purpose | Required |
|--------|---------|----------|
| `ENABLE_AI_AGENTS` | AI agents toggle | ✅ Yes |
| `LOG_LEVEL` | Logging level | ✅ Yes |

---

### Voice/WebRTC (2 secrets)

| Secret | Purpose | Required |
|--------|---------|----------|
| `VOICE_BRIDGE_URL` | Voice calls endpoint | ✅ Yes |
| `WEBRTC_BRIDGE_URL` | WebRTC endpoint | ✅ Yes |

---

## 📊 Summary

| Category | Before | After | Reduction |
|----------|--------|-------|-----------|
| **Total Secrets** | 82 | 27 | -55 (-67%) |
| **Duplicates** | 7 | 0 | -7 |
| **Deprecated** | ~40 | 0 | -40 |
| **Essential** | - | 27 | +27 |

---

## 🚀 How to Clean Up

### Option 1: Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/settings/vault/secrets
2. For each secret to delete, click the **Delete** button
3. Use the checklist below to track your progress

### Option 2: Supabase CLI

```bash
# Delete a secret
supabase secrets unset SECRET_NAME --project-ref lhbowpbcpwoiparwnwgt

# Example: Delete all duplicates
supabase secrets unset SERVICE_ROLE_KEY --project-ref lhbowpbcpwoiparwnwgt
supabase secrets unset SERVICE_URL --project-ref lhbowpbcpwoiparwnwgt
supabase secrets unset WA_SUPABASE_SERVICE_ROLE_KEY --project-ref lhbowpbcpwoiparwnwgt
# ... etc
```

---

## ✅ Cleanup Checklist

### Duplicates (7)
- [ ] `SERVICE_ROLE_KEY`
- [ ] `SERVICE_URL`
- [ ] `WA_SUPABASE_SERVICE_ROLE_KEY`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `VITE_SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `GOOGLE_SEARCH_API_KEY` (if duplicate)

### Waiter/Menu/OCR (9)
- [ ] `MENU_MEDIA_BUCKET`
- [ ] `OCR_RESULT_BUCKET`
- [ ] `OCR_MAX_ATTEMPTS`
- [ ] `OCR_QUEUE_SCAN_LIMIT`
- [ ] `OCR_MAX_MENU_CATEGORIES`
- [ ] `OCR_MAX_MENU_ITEMS`
- [ ] `INSURANCE_OCR_METRICS_WEBHOOK_URL`
- [ ] `INSURANCE_OCR_METRICS_TOKEN`
- [ ] `INSURANCE_MEDIA_BUCKET`

### Cart/Order Reminders (8)
- [ ] `CART_REMINDER_CRON`
- [ ] `CART_REMINDER_MINUTES`
- [ ] `CART_REMINDER_BATCH_SIZE`
- [ ] `ORDER_PENDING_REMINDER_LANGUAGE`
- [ ] `ORDER_PENDING_REMINDER_CRON`
- [ ] `ORDER_PENDING_REMINDER_CRON_ENABLED`
- [ ] `ORDER_PENDING_REMINDER_MINUTES`
- [ ] `ORDER_PENDING_REMINDER_BATCH_SIZE`

### Voucher System (2)
- [ ] `VOUCHER_SIGNING_SECRET`
- [ ] `VOUCHERS_BUCKET`

### Build/Dev Tools (6)
- [ ] `TURBO_CACHE`
- [ ] `TURBO_REMOTE_ONLY`
- [ ] `TURBO_RUN_SUMMARY`
- [ ] `TURBO_DOWNLOAD_LOCAL_ENABLED`
- [ ] `VITE_SUPABASE_PROJECT_ID`
- [ ] `VITE_API_BASE`

### Unused/Deprecated (20)
- [ ] `ADMIN_TOKEN`
- [ ] `ADMIN_ACCESS_CREDENTIALS`
- [ ] `ADMIN_SESSION_SECRET_FALLBACK`
- [ ] `ADMIN_FLOW_WA_ID`
- [ ] `BRIDGE_SHARED_SECRET`
- [ ] `MOMO_SMS_HMAC_SECRET`
- [ ] `KYC_SIGNED_URL_TTL_SECONDS`
- [ ] `DEEPLINK_SIGNING_SECRET`
- [ ] `BROKER_APP_BASE_URL`
- [ ] `ALERT_WEBHOOK_URL`
- [ ] `NOTIFY_WORKER_LEASE_SECONDS`
- [ ] `NOTIFY_MAX_RETRIES`
- [ ] `NOTIFY_BACKOFF_BASE_SECONDS`
- [ ] `NOTIFY_MAX_BACKOFF_SECONDS`
- [ ] `NOTIFY_DEFAULT_DELAY_SECONDS`
- [ ] `WALLET_API_KEY`
- [ ] `SIGNATURE_SECRET`
- [ ] `SERPAPI_KEY`
- [ ] `FEATURE_AGENT_ALL`
- [ ] `FEATURE_AGENT_UNIFIED_SYSTEM`

---

## ⚠️ Important Notes

1. **Backup Before Deletion**: Export all secrets before deleting
2. **Test After Cleanup**: Verify edge functions still work
3. **No Rollback**: Deleted secrets cannot be recovered
4. **Update References**: Update any code referencing deleted secrets

---

## 🔍 Verification

After cleanup, verify you have exactly 27 secrets:

```bash
supabase secrets list --project-ref lhbowpbcpwoiparwnwgt | wc -l
# Should show 27 (plus header lines)
```

---

**Last Updated**: 2025-12-13  
**Version**: 1.0  
**Status**: Ready for cleanup
