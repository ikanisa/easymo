# General Broker Agent - Implementation Complete ✅

## Status: Phase 1 Complete - Ready for Testing

**Date**: November 20, 2025  
**Author**: AI Assistant  
**Status**: Database schema + Edge functions + Agent tools implemented

---

## 🎯 What Was Implemented

### 1. Database Schema (4 Migrations) ✅

All migrations created with proper BEGIN/COMMIT wrappers:

#### Migration 1: `20251120100000_general_broker_user_memory.sql`
- **`user_locations`** table - Save home/work/school locations
- **`user_facts`** table - Persistent key-value memory
- Full RLS policies
- Proper indexes

#### Migration 2: `20251120100001_general_broker_service_requests.sql`
- **`service_requests`** table - Unified tracking across all 11 verticals
- Supports: mobility, commerce, hospitality, insurance, property, legal, jobs, farming, marketing, sora_video, support
- Geospatial indexing for location-based queries
- Status tracking (open/in_progress/fulfilled/cancelled)

#### Migration 3: `20251120100002_general_broker_vendors.sql`
- **`vendors`** table - Cross-vertical vendor registry
- **`vendor_capabilities`** table - Multi-vertical support per vendor
- **`vendors_nearby()`** PostgreSQL function - PostGIS geospatial search
- Supports radius search + category filtering

#### Migration 4: `20251120100003_general_broker_catalog_faq.sql`
- **`service_catalog`** table - EasyMO service definitions
- **`faq_articles`** table - Multilingual FAQs (EN/FR/RW/SW/LN)
- Pre-seeded with 11 services + 5 FAQs
- Full-text search support

### 2. Edge Function Tools ✅

**`supabase/functions/agent-tools-general-broker/index.ts`**

Single unified endpoint supporting 10 actions:

| Action | Purpose | Parameters |
|--------|---------|------------|
| `get_user_locations` | Fetch saved locations | `userId` |
| `upsert_user_location` | Save/update location | `userId, label, lat, lng, address, isDefault` |
| `get_user_facts` | Retrieve user memory | `userId, keys[]` |
| `upsert_user_fact` | Store preference | `userId, key, value` |
| `classify_request` | Auto-detect vertical | `query` |
| `record_service_request` | Create service request | `userId, vertical, requestType, ...` |
| `update_service_request` | Update request | `id, patch{}` |
| `find_vendors_nearby` | Geospatial vendor search | `vertical, category, lat, lng, radiusKm` |
| `search_service_catalog` | Search EasyMO services | `query` |
| `search_easymo_faq` | Search FAQs | `query, locale` |

**Features:**
- CORS headers for security
- Service role key authentication
- Classification helpers for 11 verticals
- Category detection (electronics, pharmacy, motor insurance, etc)

### 3. Agent Tools Package ✅

**`packages/agents/src/tools/generalBrokerTools.ts`**

7 tool definitions ready for OpenAI Agent integration:

1. `getUserLocationsTool` - Auto-fetch saved locations
2. `upsertUserLocationTool` - Save new locations
3. `getUserFactsTool` - Retrieve preferences
4. `recordServiceRequestTool` - Create structured memory
5. `findVendorsNearbyTool` - Vendor discovery
6. `searchFAQTool` - Platform knowledge
7. `searchServiceCatalogTool` - Service discovery

**Registered in**: `packages/agents/src/tools/index.ts`

### 4. General Broker Agent Enhanced ✅

**`packages/agents/src/agents/general/general-broker.agent.ts`**

**Key Enhancements:**
- ✅ All 7 new tools integrated
- ✅ Enhanced instructions with tool usage guidelines
- ✅ Location reuse priority (check first, never re-ask)
- ✅ Service request recording mandate
- ✅ Vendor-only recommendations (no invented data)
- ✅ Concise 2-message limit enforced
- ✅ Clear routing instructions for specialists

**Tool Usage Pattern:**
```
1. get_user_locations → Use saved location silently
2. get_user_facts → Check preferences
3. record_service_request → Create structured memory
4. find_vendors_nearby → Get real vendors only
5. Return max 3 recommendations
```

---

## 📊 Coverage Analysis

### Verticals Supported (11/11) ✅

| Vertical | Keywords | Request Types | Vendor Support |
|----------|----------|---------------|----------------|
| Mobility | ride, driver, taxi, moto | book, schedule | ✅ |
| Commerce | buy, shop, laptop, cement | buy, browse | ✅ |
| Hospitality | restaurant, menu, table | book, order | ✅ |
| Insurance | policy, claim, motor | quote, apply | ✅ |
| Property | rent, house, apartment | search, list | ✅ |
| Legal | lawyer, attorney, contract | consult, document | ✅ |
| Jobs | job, work, vacancy, hire | search, post | ✅ |
| Farming | farm, crop, seed, commodity | trade, consult | ✅ |
| Marketing | campaign, ads, crm, sales | create, manage | ✅ |
| Sora Video | sora, video ad, ai video | generate, order | ✅ |
| Support | help, problem, issue | ticket, resolve | ✅ |

### Out-of-Scope Detection ✅

**Blocked Topics** (via `service-catalog.ts`):
- News, politics, elections
- Health, medical advice (outside insurance)
- Academic help (homework, exams)
- General knowledge (science, history)
- Weather, sports, entertainment

**Multilingual Refusal Messages**: EN/FR/RW/SW/LN

---

## 🚀 Deployment Checklist

### Phase 1: Database (This PR)

- [x] Create 4 migrations
- [ ] Test migrations locally: `supabase db push`
- [ ] Verify RLS policies: `supabase db test`
- [ ] Deploy to staging
- [ ] Seed test data (vendors, FAQs, catalog)
- [ ] Run geospatial queries test

### Phase 2: Edge Functions

- [x] Create `agent-tools-general-broker` function
- [ ] Test locally: `supabase functions serve agent-tools-general-broker`
- [ ] Test all 10 actions with Postman/curl
- [ ] Deploy to staging: `supabase functions deploy agent-tools-general-broker`
- [ ] Set environment variables (SUPABASE_URL, SERVICE_ROLE_KEY)
- [ ] Monitor logs for errors

### Phase 3: Agent Package

- [x] Create `generalBrokerTools.ts`
- [x] Update `index.ts` exports
- [x] Enhance `general-broker.agent.ts`
- [ ] Build package: `pnpm --filter @va/shared build`
- [ ] Run tests: `pnpm --filter @va/shared test`
- [ ] Verify tool definitions compile

### Phase 4: Integration Testing

#### Test Scenarios:

**Commerce Flow:**
```
User: "I want to buy a laptop"
Expected:
1. Check get_user_locations
2. Record service_request (vertical: commerce, type: buy, category: electronics)
3. Call find_vendors_nearby
4. Return 3 vendors with WhatsApp numbers
```

**Property Flow:**
```
User: "I need a 2 bedroom house in Remera"
Expected:
1. Check location
2. Record service_request
3. Route to real-estate agent
```

**Vendor Onboarding:**
```
User: "I want to register my shop"
Expected:
1. Detect requestType: onboard_vendor
2. Ask: name, categories, location
3. Record service_request
4. Future: Create vendor row
```

**Out-of-Scope:**
```
User: "What's the weather today?"
Expected:
"I'm your EasyMO assistant. I can help with services like orders, property, jobs, farming, insurance, vendors, marketing and Sora videos. I can't help with topics outside EasyMO."
```

#### E2E Test:
- [ ] WhatsApp sandbox test
- [ ] Verify all 10 tools callable
- [ ] Check service_requests table populated
- [ ] Verify vendor recommendations accurate
- [ ] Test multilingual responses

### Phase 5: Admin UI (Next Sprint)

**Required Pages:**

1. **Service Requests Dashboard**
   - Path: `admin-app/app/service-requests/page.tsx`
   - Features: Filter by vertical, status, date; export CSV
   - Actions: View details, assign to staff, update status

2. **Vendors Management**
   - Path: `admin-app/app/vendors/page.tsx`
   - Features: CRUD vendors, map view, capability editor
   - Actions: Activate/deactivate, verify, edit categories

3. **Service Catalog CMS**
   - Path: `admin-app/app/catalog/page.tsx`
   - Features: Edit service descriptions, keywords, docs URLs
   - Actions: Enable/disable services, update metadata

4. **FAQ Management**
   - Path: `admin-app/app/faq/page.tsx`
   - Features: Multilingual CRUD, tag management
   - Actions: Create/edit/delete FAQs, track views

---

## 📈 Success Metrics

### Pre-Launch KPIs:

1. **Scope Compliance**: <1% out-of-scope responses (test with 100 edge cases)
2. **Service Request Creation**: 100% of meaningful asks create a row
3. **Location Reuse**: >80% use saved location without asking
4. **Vendor Accuracy**: 0% invented vendors (all from DB)
5. **Response Time**: <3s average end-to-end
6. **Tool Success Rate**: >95% tool calls succeed

### Post-Launch Monitoring:

- Service requests by vertical (track which services are popular)
- Vendor recommendations CTR (how many users contact vendors)
- Location saves (adoption of memory feature)
- FAQ views (which questions are common)
- Out-of-scope rate (false positive/negative tuning)

---

## 🔧 Configuration

### Environment Variables Required:

```bash
# Edge Function
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Agent Package (optional, defaults to local)
SUPABASE_URL=https://your-project.supabase.co
```

### Feature Flags:

```sql
-- Enable General Broker Agent
INSERT INTO feature_flags (key, value, description) VALUES
  ('general_broker_enabled', true, 'Enable General Broker Agent for all users');
```

---

## 🐛 Known Limitations & Future Work

### Current Limitations:

1. **No Voice/Call Support**: STT/TTS integration pending
2. **No SIP Trunk**: Phone call support not implemented
3. **Simple Classification**: Keyword-based, can enhance with LLM
4. **No Vector Search**: FAQ/catalog use simple keyword matching
5. **No Admin UI**: Management pages not yet built

### Future Enhancements:

**Phase 2 (Next Sprint):**
- [ ] Admin UI for service requests, vendors, catalog, FAQ
- [ ] Real-time vendor availability API
- [ ] Enhanced classification using GPT-4o
- [ ] Vector search for FAQ (semantic matching)
- [ ] User preference learning (auto-detect budget, categories)

**Phase 3 (Later):**
- [ ] Voice note STT integration
- [ ] SIP trunk for phone calls
- [ ] WhatsApp call support
- [ ] Vendor onboarding automation (self-service)
- [ ] Analytics dashboard (popular verticals, conversion rates)

**Phase 4 (Advanced):**
- [ ] Multi-modal support (images, documents)
- [ ] Agent-to-agent handoff protocol
- [ ] Conversation summarization
- [ ] Predictive recommendations
- [ ] A/B testing framework

---

## 📝 Implementation Notes

### Design Decisions:

1. **Unified Service Requests Table**: Single table for all verticals (simpler than 11 separate tables)
2. **JSONB Payload**: Flexible schema per vertical without migrations
3. **PostGIS for Geospatial**: Efficient radius queries at scale
4. **Single Edge Function**: All tools in one endpoint (easier to maintain)
5. **Keyword Classification**: Fast and deterministic (LLM fallback optional)

### Database Indexes:

- Geospatial: `user_locations`, `service_requests`, `vendors` (GIST indexes)
- Filters: `vertical`, `status`, `is_active`, `locale`
- Performance: `created_at DESC` for recent queries

### Security:

- RLS policies on all tables
- Service role key for tools (server-side only)
- User-scoped queries (auth.uid())
- Org-scoped admin access

---

## 🎓 Developer Guide

### How to Add a New Vertical:

1. **Update Service Catalog**:
   ```typescript
   // packages/agents/src/config/service-catalog.ts
   export const EASYMO_VERTICALS = [
     // ... existing
     'new_vertical',
   ] as const;
   
   export const SERVICE_CATALOG: Record<EasyMOVertical, ServiceDefinition> = {
     // ... existing
     new_vertical: {
       name: 'New Vertical',
       description: 'Description',
       agents: ['agent-slug'],
       keywords: ['keyword1', 'keyword2'],
     },
   };
   ```

2. **Update Database Constraints**:
   ```sql
   ALTER TABLE service_requests DROP CONSTRAINT service_requests_vertical_check;
   ALTER TABLE service_requests ADD CONSTRAINT service_requests_vertical_check
     CHECK (vertical IN ('mobility','commerce',...,'new_vertical'));
   ```

3. **Add Classification Logic**:
   ```typescript
   // supabase/functions/agent-tools-general-broker/index.ts
   function detectVertical(query: string): string | null {
     // ... existing
     if (/\b(new_keyword)\b/.test(lowerQuery)) return "new_vertical";
   }
   ```

4. **Seed Catalog**:
   ```sql
   INSERT INTO service_catalog (vertical, name, description, keywords) VALUES
     ('new_vertical', 'New Vertical', 'Description', ARRAY['keyword1', 'keyword2']);
   ```

### How to Test a Tool:

```bash
# Start local Supabase
supabase start

# Serve function
supabase functions serve agent-tools-general-broker

# Test with curl
curl -X POST http://localhost:54321/functions/v1/agent-tools-general-broker \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_user_locations",
    "userId": "test-user-id"
  }'
```

---

## 📚 References

- **Design Doc**: `GENERAL_BROKER_AGENT_IMPLEMENTATION.md` (detailed blueprint)
- **Current Agent**: `packages/agents/src/agents/general/general-broker.agent.ts`
- **Service Catalog**: `packages/agents/src/config/service-catalog.ts`
- **Migrations**: `supabase/migrations/20251120100000_*`
- **Edge Function**: `supabase/functions/agent-tools-general-broker/index.ts`
- **Tools**: `packages/agents/src/tools/generalBrokerTools.ts`

---

## ✅ Next Actions

1. **Test Migrations** (PRIORITY 1):
   ```bash
   supabase db push
   supabase db test
   ```

2. **Test Edge Function** (PRIORITY 1):
   ```bash
   supabase functions serve agent-tools-general-broker
   # Run Postman collection or curl tests
   ```

3. **Build & Test Package** (PRIORITY 2):
   ```bash
   pnpm --filter @va/shared build
   pnpm --filter @va/shared test
   ```

4. **Integration Test** (PRIORITY 2):
   - WhatsApp sandbox
   - Test all flows (commerce, property, insurance, etc)
   - Verify service_requests populated
   - Check vendor recommendations

5. **Deploy to Staging** (PRIORITY 3):
   ```bash
   supabase db push --environment staging
   supabase functions deploy agent-tools-general-broker --environment staging
   ```

6. **Production Deployment** (PRIORITY 4):
   - Requires: All tests passing, PM approval
   - Rollout: Gradual (10% → 50% → 100%)
   - Monitor: Error rates, response times, user feedback

---

## 🎉 Summary

**What Changed:**
- ✅ 4 database migrations (user memory, service requests, vendors, catalog/FAQ)
- ✅ 1 edge function (10 tool actions)
- ✅ 7 agent tools (TypeScript package)
- ✅ Enhanced General Broker Agent (11 verticals, strict scope)

**What's Ready:**
- Database schema for all 11 verticals
- Tool infrastructure for memory, requests, vendors
- Agent configuration with all tools

**What's Next:**
- Testing (migrations + edge function + agent)
- Admin UI (4 pages)
- Voice/call support
- Production rollout

**Impact:**
- Unified broker across all EasyMO services
- Persistent user memory (never re-ask)
- Structured request tracking (analytics-ready)
- Vendor discovery (real data only)
- Multilingual, scope-compliant assistant

---

**Status**: ✅ Phase 1 Complete - Ready for Testing  
**ETA for Production**: 2 weeks (after testing + admin UI)

