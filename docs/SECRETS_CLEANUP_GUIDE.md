# Supabase Edge Functions - Secrets Cleanup Guide

**Date:** 2025-12-13  
**Purpose:** Remove deprecated and duplicate secrets after Rwanda-only refactoring

---

## 🗑️ Secrets to DELETE (55 total)

### 1. Duplicates (7) - Keep One Version

Delete these duplicates and use the standardized version instead:

```bash
# Delete these:
SERVICE_ROLE_KEY                    # Use: SUPABASE_SERVICE_ROLE_KEY
SERVICE_URL                         # Use: SUPABASE_URL
WA_SUPABASE_SERVICE_ROLE_KEY       # Use: SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_ANON_KEY             # Use: SUPABASE_ANON_KEY
VITE_SUPABASE_SERVICE_ROLE_KEY     # Use: SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY      # Use: SUPABASE_ANON_KEY
GOOGLE_SEARCH_API_KEY              # Use: GOOGLE_MAPS_API_KEY (if same)
```

### 2. Waiter/Menu/OCR Features (8) - DEPRECATED

These are for the removed waiter/restaurant features:

```bash
MENU_MEDIA_BUCKET
OCR_RESULT_BUCKET
OCR_MAX_ATTEMPTS
OCR_QUEUE_SCAN_LIMIT
OCR_MAX_MENU_CATEGORIES
OCR_MAX_MENU_ITEMS
INSURANCE_OCR_METRICS_WEBHOOK_URL
INSURANCE_OCR_METRICS_TOKEN
INSURANCE_MEDIA_BUCKET
```

### 3. Cart/Order Reminders (9) - NOT USED

```bash
CART_REMINDER_CRON
CART_REMINDER_MINUTES
CART_REMINDER_BATCH_SIZE
ORDER_PENDING_REMINDER_LANGUAGE
ORDER_PENDING_REMINDER_CRON
ORDER_PENDING_REMINDER_CRON_ENABLED
ORDER_PENDING_REMINDER_MINUTES
ORDER_PENDING_REMINDER_BATCH_SIZE
```

### 4. Voucher System (2) - NOT IN USE

```bash
VOUCHER_SIGNING_SECRET
VOUCHERS_BUCKET
```

### 5. Build/Dev Tools (6) - SHOULDN'T BE IN EDGE FUNCTIONS

```bash
TURBO_CACHE
TURBO_REMOTE_ONLY
TURBO_RUN_SUMMARY
TURBO_DOWNLOAD_LOCAL_ENABLED
VITE_SUPABASE_PROJECT_ID
VITE_API_BASE
```

### 6. Unused/Deprecated Admin & Services (23)

```bash
# Admin
ADMIN_TOKEN                         # Use: EASYMO_ADMIN_TOKEN
ADMIN_ACCESS_CREDENTIALS
ADMIN_SESSION_SECRET_FALLBACK
ADMIN_FLOW_WA_ID

# Services
BRIDGE_SHARED_SECRET
MOMO_SMS_HMAC_SECRET
KYC_SIGNED_URL_TTL_SECONDS
DEEPLINK_SIGNING_SECRET
BROKER_APP_BASE_URL

# Notifications
ALERT_WEBHOOK_URL
NOTIFY_WORKER_LEASE_SECONDS
NOTIFY_MAX_RETRIES
NOTIFY_BACKOFF_BASE_SECONDS
NOTIFY_MAX_BACKOFF_SECONDS
NOTIFY_DEFAULT_DELAY_SECONDS

# Wallet/Payment
WALLET_API_KEY
SIGNATURE_SECRET

# Search/AI
SERPAPI_KEY

# Feature Flags (deprecated)
FEATURE_AGENT_ALL
FEATURE_AGENT_UNIFIED_SYSTEM
```

---

## ✅ Secrets to KEEP (27 total)

### Core Supabase (4)

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Database URL |
| `SUPABASE_ANON_KEY` | Public anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin/service key |
| `SUPABASE_DB_URL` | Direct database connection |

### WhatsApp (7)

| Secret | Purpose |
|--------|---------|
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID |
| `WHATSAPP_PHONE_NUMBER_E164` | Phone number (E164 format) |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification |
| `WHATSAPP_APP_SECRET` | Signature verification |
| `WHATSAPP_TEMPLATE_NAMESPACE` | Message templates |
| `META_WABA_BUSINESS_ID` | WhatsApp Business ID |

### AI/LLM (4)

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | OpenAI GPT API calls |
| `OPENAI_ORG_ID` | OpenAI organization ID |
| `OPENAI_PROJECT_ID` | OpenAI project ID |
| `GEMINI_API_KEY` | Google Gemini (backup LLM) |

### Google Services (2)

| Secret | Purpose |
|--------|---------|
| `GOOGLE_MAPS_API_KEY` | Geocoding & maps |
| `GOOGLE_SEARCH_CX` | Custom search engine |

### Security (3)

| Secret | Purpose |
|--------|---------|
| `QR_SALT` | QR code generation salt |
| `QR_TOKEN_SECRET` | QR token signing |
| `EASYMO_ADMIN_TOKEN` | Admin authentication |

### Templates (3)

| Secret | Purpose |
|--------|---------|
| `WA_INSURANCE_ADMIN_TEMPLATE` | Insurance admin notifications |
| `WA_DRIVER_NOTIFY_TEMPLATE` | Driver notifications |
| `WA_TEMPLATE_LANG` | Template language (rw/en/fr) |

### Feature Flags (2)

| Secret | Purpose |
|--------|---------|
| `ENABLE_AI_AGENTS` | AI agents toggle |
| `LOG_LEVEL` | Logging verbosity |

### Voice/WebRTC (2)

| Secret | Purpose |
|--------|---------|
| `VOICE_BRIDGE_URL` | Voice call bridge |
| `WEBRTC_BRIDGE_URL` | WebRTC connection |

---

## 📊 Summary

| Category | Before | After | Reduction |
|----------|--------|-------|-----------|
| **Total Secrets** | 82 | 27 | 67% ↓ |
| Duplicates | 7 | 0 | -7 |
| Deprecated Features | ~40 | 0 | -40 |
| Build/Dev Tools | 6 | 0 | -6 |
| Unused Services | 23 | 0 | -23 |
| **Essential** | - | 27 | ✓ |

---

## 🔧 How to Clean Up (Supabase Dashboard)

### Option 1: Supabase Dashboard UI

1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/settings/functions
2. Click on **Edge Functions**
3. Go to **Environment variables**
4. Delete each secret listed in the "DELETE" section above
5. Verify the 27 essential secrets remain

### Option 2: Supabase CLI

```bash
# Delete duplicates
supabase secrets unset SERVICE_ROLE_KEY SERVICE_URL WA_SUPABASE_SERVICE_ROLE_KEY \
  VITE_SUPABASE_ANON_KEY VITE_SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SUPABASE_ANON_KEY

# Delete waiter/menu/OCR
supabase secrets unset MENU_MEDIA_BUCKET OCR_RESULT_BUCKET OCR_MAX_ATTEMPTS \
  OCR_QUEUE_SCAN_LIMIT OCR_MAX_MENU_CATEGORIES OCR_MAX_MENU_ITEMS \
  INSURANCE_OCR_METRICS_WEBHOOK_URL INSURANCE_OCR_METRICS_TOKEN INSURANCE_MEDIA_BUCKET

# Delete cart/orders
supabase secrets unset CART_REMINDER_CRON CART_REMINDER_MINUTES CART_REMINDER_BATCH_SIZE \
  ORDER_PENDING_REMINDER_LANGUAGE ORDER_PENDING_REMINDER_CRON ORDER_PENDING_REMINDER_CRON_ENABLED \
  ORDER_PENDING_REMINDER_MINUTES ORDER_PENDING_REMINDER_BATCH_SIZE

# Delete vouchers
supabase secrets unset VOUCHER_SIGNING_SECRET VOUCHERS_BUCKET

# Delete build/dev tools
supabase secrets unset TURBO_CACHE TURBO_REMOTE_ONLY TURBO_RUN_SUMMARY \
  TURBO_DOWNLOAD_LOCAL_ENABLED VITE_SUPABASE_PROJECT_ID VITE_API_BASE

# Delete unused admin/services
supabase secrets unset ADMIN_TOKEN ADMIN_ACCESS_CREDENTIALS ADMIN_SESSION_SECRET_FALLBACK \
  ADMIN_FLOW_WA_ID BRIDGE_SHARED_SECRET MOMO_SMS_HMAC_SECRET KYC_SIGNED_URL_TTL_SECONDS \
  DEEPLINK_SIGNING_SECRET BROKER_APP_BASE_URL ALERT_WEBHOOK_URL NOTIFY_WORKER_LEASE_SECONDS \
  NOTIFY_MAX_RETRIES NOTIFY_BACKOFF_BASE_SECONDS NOTIFY_MAX_BACKOFF_SECONDS \
  NOTIFY_DEFAULT_DELAY_SECONDS WALLET_API_KEY SIGNATURE_SECRET SERPAPI_KEY \
  FEATURE_AGENT_ALL FEATURE_AGENT_UNIFIED_SYSTEM
```

### Option 3: Delete All Script

Create a file `delete_secrets.sh`:

```bash
#!/bin/bash

# Delete all deprecated secrets at once
supabase secrets unset \
  SERVICE_ROLE_KEY \
  SERVICE_URL \
  WA_SUPABASE_SERVICE_ROLE_KEY \
  VITE_SUPABASE_ANON_KEY \
  VITE_SUPABASE_SERVICE_ROLE_KEY \
  NEXT_PUBLIC_SUPABASE_ANON_KEY \
  GOOGLE_SEARCH_API_KEY \
  MENU_MEDIA_BUCKET \
  OCR_RESULT_BUCKET \
  OCR_MAX_ATTEMPTS \
  OCR_QUEUE_SCAN_LIMIT \
  OCR_MAX_MENU_CATEGORIES \
  OCR_MAX_MENU_ITEMS \
  INSURANCE_OCR_METRICS_WEBHOOK_URL \
  INSURANCE_OCR_METRICS_TOKEN \
  INSURANCE_MEDIA_BUCKET \
  CART_REMINDER_CRON \
  CART_REMINDER_MINUTES \
  CART_REMINDER_BATCH_SIZE \
  ORDER_PENDING_REMINDER_LANGUAGE \
  ORDER_PENDING_REMINDER_CRON \
  ORDER_PENDING_REMINDER_CRON_ENABLED \
  ORDER_PENDING_REMINDER_MINUTES \
  ORDER_PENDING_REMINDER_BATCH_SIZE \
  VOUCHER_SIGNING_SECRET \
  VOUCHERS_BUCKET \
  TURBO_CACHE \
  TURBO_REMOTE_ONLY \
  TURBO_RUN_SUMMARY \
  TURBO_DOWNLOAD_LOCAL_ENABLED \
  VITE_SUPABASE_PROJECT_ID \
  VITE_API_BASE \
  ADMIN_TOKEN \
  ADMIN_ACCESS_CREDENTIALS \
  ADMIN_SESSION_SECRET_FALLBACK \
  ADMIN_FLOW_WA_ID \
  BRIDGE_SHARED_SECRET \
  MOMO_SMS_HMAC_SECRET \
  KYC_SIGNED_URL_TTL_SECONDS \
  DEEPLINK_SIGNING_SECRET \
  BROKER_APP_BASE_URL \
  ALERT_WEBHOOK_URL \
  NOTIFY_WORKER_LEASE_SECONDS \
  NOTIFY_MAX_RETRIES \
  NOTIFY_BACKOFF_BASE_SECONDS \
  NOTIFY_MAX_BACKOFF_SECONDS \
  NOTIFY_DEFAULT_DELAY_SECONDS \
  WALLET_API_KEY \
  SIGNATURE_SECRET \
  SERPAPI_KEY \
  FEATURE_AGENT_ALL \
  FEATURE_AGENT_UNIFIED_SYSTEM

echo "✅ Deleted 55 deprecated secrets"
echo "✅ 27 essential secrets remain"
echo ""
echo "Verify by running: supabase secrets list"
```

Run with:
```bash
chmod +x delete_secrets.sh
./delete_secrets.sh
```

---

## ✅ Verification

After cleanup, verify you have exactly 27 secrets:

```bash
supabase secrets list
```

Should show only the 27 essential secrets listed in the "KEEP" section.

---

## 📝 Notes

- **Backup first**: Consider exporting current secrets before deletion
- **Test after**: Verify edge functions still work after cleanup
- **No rollback**: Deleted secrets cannot be recovered (except from backups)
- **Redeploy**: Edge functions may need redeployment after secret changes

---

## 🔐 Security Best Practices

1. ✅ Keep only necessary secrets
2. ✅ Use consistent naming (no duplicates)
3. ✅ Avoid `VITE_*` and `NEXT_PUBLIC_*` prefixes in edge functions
4. ✅ Regular secret rotation for API keys
5. ✅ Monitor secret usage in logs

---

**Cleanup reduces attack surface and improves security posture!**
