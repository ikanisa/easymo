# Insurance Microservice Deployment

## Summary
Created and deployed dedicated `wa-webhook-insurance` microservice to handle all insurance-related WhatsApp interactions.

**Deployment Date:** 2025-11-23 21:52 UTC  
**Service:** wa-webhook-insurance  
**Version:** v1  
**Status:** ✅ ACTIVE

---

## What Was Created

### 1. Insurance Microservice
**File:** `supabase/functions/wa-webhook-insurance/index.ts`

**Features:**
- Dedicated insurance workflow handling
- Insurance gate/unlock management
- Document upload processing (OCR)
- Admin notifications
- Media handling (images/PDFs)
- State management for insurance flows

**Imports from shared library:**
- `domains/insurance/index.ts` - Main insurance logic
- `domains/insurance/gate.ts` - Insurance feature gating
- `domains/insurance/ins_handler.ts` - Document upload handling
- `domains/insurance/ins_ocr.ts` - OCR processing
- `domains/insurance/ins_media.ts` - Media processing
- `domains/insurance/ins_normalize.ts` - Data normalization
- `domains/insurance/ins_messages.ts` - Message templates
- `domains/insurance/ins_admin_notify.ts` - Admin notifications

---

## Router Updates

### 1. wa-webhook-core/router.ts
Added insurance to routed services:
```typescript
const ROUTED_SERVICES = [
  "wa-webhook-jobs",
  "wa-webhook-marketplace",
  "wa-webhook-ai-agents",
  "wa-webhook-property",
  "wa-webhook-mobility",
  "wa-webhook-wallet",
  "wa-webhook-insurance",  // NEW
  "wa-webhook-core",
];
```

### 2. wa-webhook/router.ts
Added insurance routing rules:

**Keywords:**
```typescript
{
  service: "wa-webhook-insurance",
  keywords: ["insurance", "assurance", "cover", "claim", "policy", "premium", "insure"],
  priority: 1,
}
```

**State Routing:**
```typescript
if (chatState.includes("insurance") || chatState.includes("ins_")) {
  return "wa-webhook-insurance";
}
```

---

## Routing Logic

### When Insurance Microservice is Called:

1. **By Keyword:**
   - User sends: "insurance", "claim", "cover", "policy", etc.
   - Router → wa-webhook-insurance

2. **By State:**
   - User in state: `insurance_upload`, `ins_wait_doc`, etc.
   - Router → wa-webhook-insurance

3. **By Interaction:**
   - User clicks insurance button (IDS.INSURANCE_START)
   - Router → wa-webhook-insurance

### Message Flow:
```
WhatsApp User
     ↓
WhatsApp Cloud API
     ↓
wa-webhook-core (Router)
     ↓
[Checks keyword: "insurance"]
     ↓
wa-webhook-insurance
     ↓
Insurance Domain Logic
     ↓
Response to User
```

---

## Deployment

### Deployed Services:
```bash
# Insurance microservice
supabase functions deploy wa-webhook-insurance

# Core router (with insurance routing)
supabase functions deploy wa-webhook-core
```

### Verification:
```bash
$ supabase functions list | grep insurance
wa-webhook-insurance | ACTIVE | v1 | 2025-11-23 21:52:18 ✅
```

---

## Testing

### Test Insurance Routing:

1. **Keyword Test:**
   ```
   User sends: "insurance"
   Expected: Routes to wa-webhook-insurance
   ```

2. **State Test:**
   ```
   User in state: "insurance_upload"
   User sends: (image)
   Expected: Routes to wa-webhook-insurance
   ```

3. **Button Test:**
   ```
   User clicks: Insurance button
   Expected: Routes to wa-webhook-insurance
   ```

### Health Check:
```bash
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-insurance/health
```

Expected Response:
```json
{
  "status": "healthy",
  "service": "wa-webhook-insurance",
  "timestamp": "2025-11-23T21:52:18.000Z"
}
```

---

## Insurance Features

### 1. Insurance Gate
- Controls access to insurance features
- Checks if user is eligible
- Sends gated message if not eligible

### 2. Document Upload
- Handles image/PDF uploads
- OCR processing for document extraction
- Validation and normalization

### 3. Admin Notifications
- Notifies admins of new insurance claims
- Sends to insurance_admin_contacts

### 4. Flow Management
- State: `insurance_upload` - Waiting for document
- State: `ins_wait_doc` - Processing document
- State: `insurance_complete` - Claim submitted

---

## Architecture

### Before (All in Core):
```
wa-webhook-core
  ├─ Insurance logic
  ├─ Mobility logic
  ├─ Wallet logic
  ├─ Jobs logic
  └─ Property logic
```

### After (Microservices):
```
wa-webhook-core (Router)
  ├→ wa-webhook-insurance ✨ NEW
  ├→ wa-webhook-mobility
  ├→ wa-webhook-wallet
  ├→ wa-webhook-jobs
  └→ wa-webhook-property
```

---

## Files Modified

1. **Created:**
   - `supabase/functions/wa-webhook-insurance/index.ts`

2. **Updated:**
   - `supabase/functions/wa-webhook-core/router.ts`
   - `supabase/functions/wa-webhook/router.ts`

3. **Shared (Imported):**
   - `supabase/functions/wa-webhook/domains/insurance/*` (10 files)

---

## Benefits

### 1. Separation of Concerns
- Insurance logic isolated in its own service
- Easier to maintain and debug
- Clear ownership

### 2. Scalability
- Insurance service can scale independently
- Can handle high volume of insurance claims
- No impact on other services

### 3. Monitoring
- Dedicated logs for insurance service
- Insurance-specific metrics
- Easier troubleshooting

### 4. Deployment
- Deploy insurance changes without affecting other services
- Faster deployment cycles
- Reduced risk

---

## Monitoring

### Key Metrics to Track:
- `INSURANCE_WEBHOOK_RECEIVED` - Total requests
- `INSURANCE_GATED` - Users blocked by gate
- `INSURANCE_STATE` - Current state distribution
- `INSURANCE_UNHANDLED` - Unprocessed messages
- `INSURANCE_ERROR` - Error rate

### Logs to Watch:
```bash
# View insurance logs
supabase functions logs wa-webhook-insurance --project-ref lhbowpbcpwoiparwnwgt

# Filter for errors
supabase functions logs wa-webhook-insurance | grep ERROR
```

---

## Next Steps

### Recommended:
1. ✅ Test insurance keyword routing
2. ✅ Test document upload flow
3. ✅ Verify admin notifications
4. ✅ Monitor error rates
5. ⏳ Add insurance-specific analytics
6. ⏳ Implement retry logic for failed OCR
7. ⏳ Add insurance dashboard

---

## Version History

**v1** (2025-11-23 21:52:18)
- Initial deployment
- Insurance routing implemented
- All insurance domains imported
- Gate/unlock functionality
- Document upload & OCR
- Admin notifications

---

**Deployment Status:** ✅ LIVE  
**Dashboard:** https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions
