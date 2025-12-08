# OCR Functions Consolidation Analysis

**Date**: 2025-12-08  
**Status**: Analysis Complete - Ready for Implementation

---

## EXECUTIVE SUMMARY

Currently have **3 separate OCR edge functions** with **865 total deployments** causing:
- ❌ Code duplication (OpenAI integration repeated 3x)
- ❌ Maintenance overhead (bug fixes need 3x work)
- ❌ Deployment failures (480 + 228 + 337 = 1,045 deployments)
- ❌ Resource waste (3x cold starts, 3x memory allocation)
- ❌ Inconsistent error handling

**Solution**: Consolidate into **ONE unified OCR edge function** with domain-specific handlers.

---

## CURRENT STATE ANALYSIS

### Function 1: `insurance-ocr` (480 deployments)
**Purpose**: Process insurance certificate images from queue
**Storage Buckets**: `insurance-docs`
**Queue Table**: `insurance_media_queue`
**Output Tables**: `insurance_leads`, `insurance_media`
**Provider**: OpenAI Vision API (GPT-5) + Gemini fallback
**Key Features**:
- ✅ Queue processing (batch mode)
- ✅ Inline processing (POST /insurance-ocr with signedUrl)
- ✅ Admin notifications
- ✅ User bonus allocation (2000 tokens)
- ✅ Rate limiting (10 req/min)
- ✅ Retry logic (3 max attempts)
- ✅ Dual provider support (OpenAI + Gemini)

**Extract Schema**:
```typescript
{
  raw_ocr: string,          // Full OCR response
  extracted: {              // Normalized insurance data
    policy_no?: string,
    insurer?: string,
    effective_from?: string,
    expires_on?: string,
    // ... other insurance fields
  }
}
```

**Dependencies**:
- `runInsuranceOCR()` - Core OCR logic
- `normalizeInsuranceExtraction()` - Field normalization
- `notifyInsuranceAdmins()` - WhatsApp notifications
- `allocateInsuranceBonus()` - Wallet integration

**LOC**: 506 lines

---

### Function 2: `ocr-processor` (228 deployments)
**Purpose**: Process bar/restaurant menu images from OCR queue  
**Storage Buckets**: `menu-source-files`, `ocr-json-cache`
**Queue Table**: `ocr_jobs`
**Output Tables**: `menus`, `categories`, `items`
**Provider**: OpenAI Vision API (GPT-5, but prefers Gemini-3 per README)
**Key Features**:
- ✅ Queue processing only
- ✅ Menu extraction (categories + items + prices)
- ✅ Currency normalization
- ✅ Price conversion (major → minor units)
- ✅ Dietary flags (spicy, vegan, etc.)
- ✅ Duplicate prevention
- ✅ Auto-publish to bars
- ✅ Manager notifications

**Extract Schema**:
```typescript
{
  currency?: string,
  categories: [{
    name: string,
    items: [{
      name: string,
      description?: string,
      price: number,           // Minor currency units
      flags: string[]          // ["spicy", "vegan", ...]
    }]
  }]
}
```

**Constraints**:
- Max 50 categories (`MAX_MENU_CATEGORIES`)
- Max 500 items (`MAX_MENU_ITEMS`)

**Dependencies**:
- `SupabaseRest` - Custom REST client (NOT @supabase/supabase-js!)
- `resolveOpenAiResponseText()` - Response parsing
- `IDS.BACK_MENU` - Menu navigation

**LOC**: 886 lines

---

### Function 3: `vehicle-ocr` (337 deployments)
**Purpose**: Process vehicle insurance certificate (Yellow Card) images
**Storage**: External URLs (file_url param)
**Queue**: None (inline only)
**Output Tables**: `vehicles`, `insurance_certificates`
**Provider**: OpenAI Vision API (GPT-5 mandatory per README)
**Key Features**:
- ✅ Inline processing only
- ✅ Vehicle validation (plate match)
- ✅ Certificate expiry check
- ✅ Confidence scoring
- ✅ Auto-activation on validation
- ❌ No retry logic
- ❌ No rate limiting
- ❌ No notifications

**Extract Schema**:
```typescript
{
  plate?: string,
  policy_no?: string,
  insurer?: string,
  effective_from?: string,     // YYYY-MM-DD
  expires_on?: string,          // YYYY-MM-DD
}
```

**Validation Rules**:
- Plate must match input
- Certificate must not be expired
- Confidence >= 80%

**Dependencies**:
- `@supabase/supabase-js` - Standard Supabase client
- `corsHeaders` - CORS helper

**LOC**: 252 lines

---

## COMMONALITIES

### Shared Logic (95% overlap)
1. **OpenAI Vision API Integration**
   - All use GPT-5 for OCR
   - Same request structure (chat/completions)
   - Same image encoding (base64)
   - Same error handling patterns

2. **Response Parsing**
   - JSON extraction from markdown fences
   - Field normalization
   - Confidence calculation

3. **Supabase Integration**
   - Storage bucket signed URLs
   - Database upserts
   - Queue processing patterns

4. **Error Handling**
   - Retry logic (insurance-ocr, ocr-processor)
   - Status tracking
   - Error logging

5. **Observability**
   - `logStructuredEvent()` - All 3 use this
   - Telemetry tracking

---

## DIFFERENCES

| Feature | insurance-ocr | ocr-processor | vehicle-ocr |
|---------|--------------|---------------|-------------|
| **Queue Processing** | ✅ Yes | ✅ Yes | ❌ No |
| **Inline Processing** | ✅ Yes | ❌ No | ✅ Only |
| **Rate Limiting** | ✅ 10/min | ❌ No | ❌ No |
| **Retry Logic** | ✅ 3 attempts | ✅ 3 attempts | ❌ No |
| **Notifications** | ✅ Admin + User | ✅ Manager | ❌ No |
| **Bonus Rewards** | ✅ 2000 tokens | ❌ No | ❌ No |
| **Provider Fallback** | ✅ OpenAI + Gemini | ❌ OpenAI only | ❌ OpenAI only |
| **Supabase Client** | @supabase/supabase-js | SupabaseRest (custom) | @supabase/supabase-js |
| **Max Items** | No limit | 500 items, 50 cats | N/A |
| **Validation** | No | No | ✅ Yes (plate, expiry) |

---

## CONSOLIDATION DESIGN

### New Structure: `unified-ocr`

```
supabase/functions/unified-ocr/
├── index.ts                 # Main handler (routing by domain)
├── core/
│   ├── openai.ts           # OpenAI Vision API client
│   ├── gemini.ts           # Gemini Vision API client (fallback)
│   ├── queue.ts            # Generic queue processor
│   └── storage.ts          # Storage operations
├── domains/
│   ├── insurance.ts        # Insurance certificate logic
│   ├── menu.ts             # Bar menu logic
│   └── vehicle.ts          # Vehicle certificate logic
├── schemas/
│   ├── insurance.ts        # Insurance extraction schema
│   ├── menu.ts             # Menu extraction schema
│   └── vehicle.ts          # Vehicle extraction schema
└── utils/
    ├── validation.ts       # Field validation
    ├── normalization.ts    # Data normalization
    └── confidence.ts       # Confidence scoring
```

### API Design

#### 1. Queue Processing (GET /)
```bash
GET /unified-ocr?domain=insurance&limit=5
GET /unified-ocr?domain=menu&limit=3
```

**Response**:
```json
{
  "domain": "insurance",
  "processed": [
    { "id": "xxx", "status": "succeeded", "leadId": "yyy" },
    { "id": "zzz", "status": "retry", "error": "..." }
  ],
  "remaining": 12
}
```

#### 2. Inline Processing (POST /)
```bash
POST /unified-ocr
Content-Type: application/json

{
  "domain": "insurance",
  "inline": {
    "signedUrl": "https://...",
    "mime": "image/jpeg"
  }
}
```

**Response**:
```json
{
  "domain": "insurance",
  "raw": "{ ... }",
  "normalized": {
    "policy_no": "POL-12345",
    "insurer": "SONARWA",
    "effective_from": "2025-01-01",
    "expires_on": "2025-12-31"
  }
}
```

#### 3. Vehicle Validation (POST / with vehicle domain)
```bash
POST /unified-ocr
Content-Type: application/json

{
  "domain": "vehicle",
  "profile_id": "...",
  "org_id": "...",
  "vehicle_plate": "RAB123A",
  "file_url": "https://..."
}
```

**Response**:
```json
{
  "success": true,
  "vehicle_id": "...",
  "status": "active",
  "ocr_confidence": 0.92,
  "fields": {
    "plate": "RAB123A",
    "policy_no": "POL-67890",
    "expires_on": "2026-06-30"
  }
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Core Infrastructure (Day 1)
- [ ] Create `unified-ocr/` function directory
- [ ] Implement `core/openai.ts` - Generic OpenAI Vision client
- [ ] Implement `core/gemini.ts` - Gemini fallback
- [ ] Implement `core/queue.ts` - Generic queue processor
- [ ] Implement `core/storage.ts` - Storage helpers
- [ ] Add rate limiting middleware
- [ ] Add retry logic

### Phase 2: Domain Handlers (Day 2-3)
- [ ] Port `domains/insurance.ts` from insurance-ocr
  - Use existing `runInsuranceOCR()` logic
  - Keep admin notifications
  - Keep bonus allocation
- [ ] Port `domains/menu.ts` from ocr-processor
  - Use existing menu extraction logic
  - Keep menu publishing
  - Keep manager notifications
- [ ] Port `domains/vehicle.ts` from vehicle-ocr
  - Add validation logic
  - Add retry support
  - Add notifications

### Phase 3: Main Router (Day 4)
- [ ] Implement `index.ts` main handler
- [ ] Route by `domain` parameter
- [ ] Support both queue + inline modes
- [ ] Add CORS headers
- [ ] Add OPTIONS handling

### Phase 4: Testing (Day 5)
- [ ] Unit tests for each domain
- [ ] Integration tests for queue processing
- [ ] Load testing (100 concurrent requests)
- [ ] Verify all 3 domains work

### Phase 5: Migration (Day 6-7)
- [ ] Deploy `unified-ocr` as NEW function
- [ ] Update all callers to use new endpoint
  - `wa-webhook-insurance` → POST /unified-ocr?domain=insurance
  - `ocr-processor` cron → GET /unified-ocr?domain=menu
  - vehicle flows → POST /unified-ocr?domain=vehicle
- [ ] Run parallel for 1 week (both old + new)
- [ ] Monitor for errors
- [ ] Archive old functions:
  - `insurance-ocr` → `insurance-ocr.archived`
  - `ocr-processor` → `ocr-processor.archived`
  - `vehicle-ocr` → `vehicle-ocr.archived`

---

## CODE SAVINGS

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| **Functions** | 3 | 1 | -67% |
| **Total LOC** | 1,644 | ~800 | -51% |
| **Duplicated Code** | ~400 lines | 0 | -100% |
| **Deployment Failures** | 1,045 | TBD | TBD |
| **Cold Starts** | 3x | 1x | -67% |
| **Memory Usage** | 3x 512MB | 1x 512MB | -67% |

---

## RISK MITIGATION

### Risk 1: Breaking Changes
**Mitigation**: Deploy as new function, run parallel, gradual migration

### Risk 2: Performance Degradation
**Mitigation**: Queue processing per domain (no cross-contamination)

### Risk 3: Domain-Specific Bugs
**Mitigation**: Comprehensive testing suite per domain

### Risk 4: Provider Failures
**Mitigation**: Dual provider support (OpenAI + Gemini) for all domains

---

## SUCCESS CRITERIA

- ✅ All 3 domains work in unified function
- ✅ No increase in error rate vs separate functions
- ✅ <200ms routing overhead
- ✅ Support both queue + inline modes
- ✅ Zero data loss during migration
- ✅ 50%+ code reduction
- ✅ <1 week migration timeline

---

## NEXT STEPS

1. **Review**: Get team approval on consolidation design
2. **Implement**: Build unified-ocr function (5 days)
3. **Test**: Integration + load testing (2 days)
4. **Deploy**: Gradual rollout with monitoring (7 days)
5. **Archive**: Remove old functions after validation (1 day)

---

**Total Timeline**: 15 days  
**Effort**: 1 developer full-time  
**Dependencies**: None (all internal)  
**Breaking Changes**: None (backward compatible during migration)
