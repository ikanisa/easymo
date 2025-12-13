# Edge Function Secrets - Quick Deletion Checklist

**Total to Delete:** 55 secrets  
**Total to Keep:** 27 secrets

---

## ⚠️ DELETE THESE FIRST (Security Critical)

### Priority 1: 🚨 CRITICAL Security Issues
```
☐ VITE_SUPABASE_SERVICE_ROLE_KEY (CRITICAL - exposes service role!)
☐ VITE_SUPABASE_ANON_KEY
☐ VITE_SUPABASE_PROJECT_ID
☐ VITE_API_BASE
```

### Priority 2: Duplicates (keep the SUPABASE_* versions)
```
☐ SERVICE_ROLE_KEY
☐ SERVICE_URL
☐ WA_SUPABASE_SERVICE_ROLE_KEY
☐ NEXT_PUBLIC_SUPABASE_ANON_KEY
☐ NEXT_PUBLIC_SUPABASE_URL
☐ ADMIN_TOKEN (keep EASYMO_ADMIN_TOKEN)
☐ GOOGLE_SEARCH_API_KEY (keep GOOGLE_MAPS_API_KEY)
```

---

## DELETE THESE (Obsolete Services)

### Waiter/Menu/OCR (9 secrets)
```
☐ MENU_MEDIA_BUCKET
☐ OCR_RESULT_BUCKET
☐ OCR_MAX_ATTEMPTS
☐ OCR_QUEUE_SCAN_LIMIT
☐ OCR_MAX_MENU_CATEGORIES
☐ OCR_MAX_MENU_ITEMS
☐ INSURANCE_OCR_METRICS_WEBHOOK_URL
☐ INSURANCE_OCR_METRICS_TOKEN
☐ INSURANCE_MEDIA_BUCKET
```

### Cart/Order Reminders (8 secrets)
```
☐ CART_REMINDER_CRON
☐ CART_REMINDER_MINUTES
☐ CART_REMINDER_BATCH_SIZE
☐ ORDER_PENDING_REMINDER_LANGUAGE
☐ ORDER_PENDING_REMINDER_CRON
☐ ORDER_PENDING_REMINDER_CRON_ENABLED
☐ ORDER_PENDING_REMINDER_MINUTES
☐ ORDER_PENDING_REMINDER_BATCH_SIZE
```

### Vouchers (2 secrets)
```
☐ VOUCHER_SIGNING_SECRET
☐ VOUCHERS_BUCKET
```

### Build Tools (4 secrets)
```
☐ TURBO_CACHE
☐ TURBO_REMOTE_ONLY
☐ TURBO_RUN_SUMMARY
☐ TURBO_DOWNLOAD_LOCAL_ENABLED
```

### Notifications Worker (5 secrets)
```
☐ NOTIFY_WORKER_LEASE_SECONDS
☐ NOTIFY_MAX_RETRIES
☐ NOTIFY_BACKOFF_BASE_SECONDS
☐ NOTIFY_MAX_BACKOFF_SECONDS
☐ NOTIFY_DEFAULT_DELAY_SECONDS
```

### Unused/Deprecated (17 secrets)
```
☐ ADMIN_ACCESS_CREDENTIALS
☐ ADMIN_SESSION_SECRET
☐ ADMIN_SESSION_SECRET_FALLBACK
☐ ADMIN_FLOW_WA_ID
☐ BRIDGE_SHARED_SECRET
☐ MOMO_SMS_HMAC_SECRET
☐ KYC_SIGNED_URL_TTL_SECONDS
☐ DEEPLINK_SIGNING_SECRET
☐ BROKER_APP_BASE_URL
☐ ALERT_WEBHOOK_URL
☐ WALLET_API_KEY
☐ SIGNATURE_SECRET
☐ SERPAPI_KEY
☐ FEATURE_AGENT_ALL
☐ FEATURE_AGENT_UNIFIED_SYSTEM
☐ OPENAI_WEBHOOK_SECRET
☐ OPENAI_REALTIME_MODEL
☐ WHATSAPP_SEND_ENDPOINT
☐ WHATSAPP_SYSTEM_USER_ID
☐ WA_ALLOW_UNSIGNED_WEBHOOKS
☐ EDGE_CACHE_BUSTER
```

---

## ✅ KEEP THESE (27 secrets)

### Core Supabase (4)
```
✓ SUPABASE_URL
✓ SUPABASE_ANON_KEY
✓ SUPABASE_SERVICE_ROLE_KEY
✓ SUPABASE_DB_URL
```

### WhatsApp (7)
```
✓ WHATSAPP_ACCESS_TOKEN
✓ WHATSAPP_PHONE_NUMBER_ID
✓ WHATSAPP_PHONE_NUMBER_E164
✓ WHATSAPP_VERIFY_TOKEN
✓ WHATSAPP_APP_SECRET
✓ WHATSAPP_TEMPLATE_NAMESPACE
✓ META_WABA_BUSINESS_ID
```

### AI/LLM (4)
```
✓ OPENAI_API_KEY
✓ OPENAI_ORG_ID
✓ OPENAI_PROJECT_ID
✓ GEMINI_API_KEY
```

### Google (2)
```
✓ GOOGLE_MAPS_API_KEY
✓ GOOGLE_SEARCH_CX
```

### Security (3)
```
✓ QR_SALT
✓ QR_TOKEN_SECRET
✓ EASYMO_ADMIN_TOKEN
```

### Templates (3)
```
✓ WA_INSURANCE_ADMIN_TEMPLATE
✓ WA_DRIVER_NOTIFY_TEMPLATE
✓ WA_TEMPLATE_LANG
```

### Feature Flags (2)
```
✓ ENABLE_AI_AGENTS
✓ LOG_LEVEL
```

### Voice/WebRTC (2)
```
✓ VOICE_BRIDGE_URL
✓ WEBRTC_BRIDGE_URL
```

---

## Progress Tracker

- [ ] **Phase 1:** Delete VITE_* secrets (4 secrets) ← START HERE
- [ ] **Phase 2:** Delete duplicates (7 secrets)
- [ ] **Phase 3:** Delete waiter/OCR (9 secrets)
- [ ] **Phase 4:** Delete cart/reminders (8 secrets)
- [ ] **Phase 5:** Delete build tools (4 secrets)
- [ ] **Phase 6:** Delete unused (23 secrets)
- [ ] **Phase 7:** Test Edge Functions
- [ ] **Phase 8:** Verify WhatsApp works
- [ ] **Phase 9:** Verify AI integrations

---

## How to Delete

1. Open Supabase Dashboard
2. Go to: **Project Settings → Edge Functions → Secrets**
3. Search for secret name
4. Click trash icon
5. Confirm deletion
6. Check off this list ✓

**Pro Tip:** Delete in phases and test after each phase!
