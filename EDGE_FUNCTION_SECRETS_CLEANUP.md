# Edge Function Secrets Cleanup Guide

**Generated:** 2025-12-13  
**Updated:** 2025-12-13 (Final Review)  
**Purpose:** Clean up obsolete Edge Function secrets after Day 9-10 cleanup

---

## ⚠️ CRITICAL SECURITY ISSUE

🚨 **`VITE_SUPABASE_SERVICE_ROLE_KEY` exposes the service role key to client-side code!**

This is a **severe security vulnerability**. The `VITE_` prefix means this secret would be bundled into client JavaScript, exposing your service role key publicly.

**ACTION REQUIRED:** Delete this secret immediately!

---

## Summary

- **Current Secrets:** 82 total
- **Keep:** 27 secrets (essential only)
- **Delete:** 55 secrets (duplicates + obsolete)
- **Cleanup Ratio:** 67% reduction

---

## Secrets to KEEP ✅ (27 total)

### Core Supabase (4 secrets)
| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Database URL |
| `SUPABASE_ANON_KEY` | Public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key |
| `SUPABASE_DB_URL` | Direct DB connection |

### WhatsApp Business API (7 secrets)
| Secret | Purpose |
|--------|---------|
| `WHATSAPP_ACCESS_TOKEN` | API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone ID |
| `WHATSAPP_PHONE_NUMBER_E164` | Phone number |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verify |
| `WHATSAPP_APP_SECRET` | Signature verify |
| `WHATSAPP_TEMPLATE_NAMESPACE` | Templates |
| `META_WABA_BUSINESS_ID` | Business ID |

### AI/LLM Services (4 secrets)
| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | GPT calls |
| `OPENAI_ORG_ID` | Org ID |
| `OPENAI_PROJECT_ID` | Project ID |
| `GEMINI_API_KEY` | Gemini backup |

### Google Services (2 secrets)
| Secret | Purpose |
|--------|---------|
| `GOOGLE_MAPS_API_KEY` | Geocoding |
| `GOOGLE_SEARCH_CX` | Search engine ID |

### Security (3 secrets)
| Secret | Purpose |
|--------|---------|
| `QR_SALT` | QR generation |
| `QR_TOKEN_SECRET` | QR tokens |
| `EASYMO_ADMIN_TOKEN` | Admin auth |

### WhatsApp Templates (3 secrets)
| Secret | Purpose |
|--------|---------|
| `WA_INSURANCE_ADMIN_TEMPLATE` | Insurance notifications |
| `WA_DRIVER_NOTIFY_TEMPLATE` | Driver notifications |
| `WA_TEMPLATE_LANG` | Template language |

### Feature Flags (2 secrets)
| Secret | Purpose |
|--------|---------|
| `ENABLE_AI_AGENTS` | AI toggle |
| `LOG_LEVEL` | Logging |

### Voice/WebRTC (2 secrets)
| Secret | Purpose |
|--------|---------|
| `VOICE_BRIDGE_URL` | Voice calls |
| `WEBRTC_BRIDGE_URL` | WebRTC |

---

## Secrets to DELETE ❌ (55 total)

### 1. 🚨 CRITICAL - Duplicates (7 secrets - DELETE FIRST)

| Delete | Keep Instead | Reason |
|--------|--------------|--------|
| `SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | Duplicate |
| `SERVICE_URL` | `SUPABASE_URL` | Duplicate |
| `WA_SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | Duplicate |
| `VITE_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` | 🚨 Client-side exposure |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | 🚨 CRITICAL security issue! |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` | Duplicate |
| `GOOGLE_SEARCH_API_KEY` | `GOOGLE_MAPS_API_KEY` | Same key |

### 2. Waiter/Menu/OCR Related (9 secrets)

Service removed in Day 9-10 cleanup:

```
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

### 3. Cart/Order Reminders (8 secrets)

Feature not used:

```
CART_REMINDER_CRON
CART_REMINDER_MINUTES
CART_REMINDER_BATCH_SIZE
ORDER_PENDING_REMINDER_LANGUAGE
ORDER_PENDING_REMINDER_CRON
ORDER_PENDING_REMINDER_CRON_ENABLED
ORDER_PENDING_REMINDER_MINUTES
ORDER_PENDING_REMINDER_BATCH_SIZE
```

### 4. Voucher System (2 secrets)

Not in simplified system:

```
VOUCHER_SIGNING_SECRET
VOUCHERS_BUCKET
```

### 5. Build/Dev Tools (6 secrets)

Shouldn't be in edge functions:

```
TURBO_CACHE
TURBO_REMOTE_ONLY
TURBO_RUN_SUMMARY
TURBO_DOWNLOAD_LOCAL_ENABLED
VITE_SUPABASE_PROJECT_ID
VITE_API_BASE
```

### 6. Unused/Deprecated (23 secrets)

```
ADMIN_TOKEN
ADMIN_ACCESS_CREDENTIALS
ADMIN_SESSION_SECRET_FALLBACK
ADMIN_FLOW_WA_ID
BRIDGE_SHARED_SECRET
MOMO_SMS_HMAC_SECRET
KYC_SIGNED_URL_TTL_SECONDS
DEEPLINK_SIGNING_SECRET
BROKER_APP_BASE_URL
ALERT_WEBHOOK_URL
NOTIFY_WORKER_LEASE_SECONDS
NOTIFY_MAX_RETRIES
NOTIFY_BACKOFF_BASE_SECONDS
NOTIFY_MAX_BACKOFF_SECONDS
NOTIFY_DEFAULT_DELAY_SECONDS
WALLET_API_KEY
SIGNATURE_SECRET
SERPAPI_KEY
FEATURE_AGENT_ALL
FEATURE_AGENT_UNIFIED_SYSTEM
OPENAI_WEBHOOK_SECRET
OPENAI_REALTIME_MODEL
WHATSAPP_SEND_ENDPOINT
WHATSAPP_SYSTEM_USER_ID
WA_ALLOW_UNSIGNED_WEBHOOKS
ADMIN_SESSION_SECRET
EDGE_CACHE_BUSTER
NEXT_PUBLIC_SUPABASE_URL
```

---

## How to Delete Secrets

### Via Supabase Dashboard

1. Go to: **Project Settings → Edge Functions → Secrets**
2. Search for each secret name
3. Click the trash icon to delete
4. Confirm deletion

### Important Notes

- **Backup first**: Export/document critical values before deleting
- **Test after**: Verify Edge Functions still work after cleanup
- **Delete in batches**: Delete by category and test incrementally
- **Critical first**: Start with VITE_* secrets (security issue)

---

## Post-Cleanup Verification

After deleting secrets, test these functions:

1. ✅ WhatsApp webhook (buy-sell-agent)
2. ✅ AI agent responses
3. ✅ Authentication/admin access
4. ✅ Google Maps integration
5. ✅ OpenAI integration

---

## Duplicate Consolidation (Optional)

Consider consolidating these duplicates:

| Keep | Delete |
|------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY`, `WA_SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_URL` | `SERVICE_URL` |
| `EASYMO_ADMIN_TOKEN` | `ADMIN_TOKEN` (if different, keep both) |
| `GEMINI_API_KEY` | (remove one of the duplicates) |

---

## Final State

After cleanup, you should have approximately **27 secrets** for:

- ✅ Core Supabase infrastructure
- ✅ WhatsApp Business API
- ✅ AI services (OpenAI, Gemini, Google)
- ✅ Authentication
- ✅ Security tokens

All obsolete service secrets removed. ✨
