# WhatsApp Webhook Architecture Analysis - Past 48 Hours

**Analysis Date:** 2025-11-23  
**Scope:** Deployment review and routing optimization

## Current Architecture

### 1. **wa-webhook** (v535) - MAIN MONOLITH
**Role:** Primary webhook receiver - handles ALL WhatsApp messages  
**Last Deployed:** 2025-11-23 21:27:13

**Contains:**
- Full routing system (`router/pipeline.ts`, `router/router.ts`)
- All domain handlers:
  - `domains/insurance/` - Insurance document processing
  - `domains/wallet/` - Wallet operations
  - `domains/profile/` - User profiles
  - `domains/shops/` - Shop listings
  - `domains/recent/` - Recent activity
- All flows:
  - `flows/vendor/menu.ts` - Restaurant menu uploads
  - `flows/momo/` - Mobile money
  - `flows/home.ts` - Home menu
  - `flows/admin/` - Admin operations
- Message routing:
  - `router/media.ts` - Image/document handling
  - `router/text.ts` - Text message handling
  - `router/interactive_button.ts` - Button clicks
  - `router/interactive_list.ts` - List selections

**Recent Changes (48h):**
1. Insurance routing fix (vendor menu skip)
2. Deno crypto API modernization
3. MoMo QR routing updates
4. Interactive button routing changes

### 2. **wa-webhook-core** (v212) - ROUTER/DISPATCHER
**Role:** Routes incoming webhooks to specialized services  
**Last Deployed:** 2025-11-23 21:27:13

**Contains:**
- Service routing logic (`router.ts`)
- Forwarding to edge services
- Health check aggregation
- Telemetry/latency tracking

**Does NOT contain:** Domain logic, message processing

### 3. **wa-webhook-ai-agents** (v164) - AI ORCHESTRATOR
**Role:** AI-powered intent parsing and agent routing  
**Last Deployed:** 2025-11-23 21:27:13

**Contains:**
- Agent orchestrator
- Intent parsing
- Multi-agent coordination
- Proactive messaging templates

**Does NOT contain:** Insurance, wallet, vendor logic

### 4. **wa-webhook-mobility** (v131) - RIDES/NEARBY
**Role:** Standalone mobility features  
**Last Deployed:** 2025-11-23 21:27:13

**Contains:**
- Complete standalone implementation
- Own routing, handlers, state management
- Nearby drivers/passengers
- Schedule trip
- Vehicle management

**Does NOT contain:** Insurance, wallet, vendor logic

### 5. **wa-webhook-wallet** (v57) - WALLET OPS
**Role:** Wallet-specific operations (standalone)  
**Last Deployed:** 2025-11-23 21:27:13

### 6. **wa-webhook-jobs** (v133) - JOBS BOARD
**Role:** Job listings (standalone)  
**Last Deployed:** 2025-11-23 21:27:13

### 7. **wa-webhook-property** (v112) - PROPERTY RENTALS
**Role:** Property listings (standalone)  
**Last Deployed:** 2025-11-23 21:27:13

---

## Problem Analysis

### Issue 1: Code in Wrong Place
**Changes made to `wa-webhook` shared folder affect ALL deployments**

Recent 48h changes to `wa-webhook/`:
- `flows/vendor/menu.ts` - Insurance routing fix
- `router/interactive_button.ts` - Button routing
- `router/text.ts` - Text routing
- `flows/momo/qr.ts` - QR routing

**Problem:** When we edit these files and deploy ALL microservices, we're redeploying services that DON'T use this code!

### Issue 2: Which Service Uses What?

| Code Location | Used By | NOT Used By |
|---------------|---------|-------------|
| `wa-webhook/router/` | **wa-webhook ONLY** | core, ai-agents, mobility, wallet, jobs, property |
| `wa-webhook/domains/insurance/` | **wa-webhook ONLY** | ALL others |
| `wa-webhook/flows/vendor/` | **wa-webhook ONLY** | ALL others |
| `wa-webhook/flows/momo/` | **wa-webhook ONLY** | ALL others |
| `_shared/` | ALL services | - |

### Issue 3: Deployment Waste
When we run `pnpm run functions:deploy:wa`, we deploy:
- ✅ `wa-webhook` - NEEDED (has the code)
- ❌ `wa-webhook-core` - NOT NEEDED (doesn't import from wa-webhook)
- ❌ `wa-webhook-ai-agents` - NOT NEEDED (standalone)
- ❌ `wa-webhook-mobility` - NOT NEEDED (standalone)
- ❌ `wa-webhook-wallet` - NOT NEEDED (standalone)
- ❌ `wa-webhook-jobs` - NOT NEEDED (standalone)
- ❌ `wa-webhook-property` - NOT NEEDED (standalone)

---

## Recommended Routing Architecture

### Option A: Keep Current (Simple)
**Status Quo:** All messages → `wa-webhook` monolith

**Pros:**
- Simple, single entry point
- All logic in one place
- Easy to debug

**Cons:**
- Large function
- Slow cold starts
- Single point of failure

### Option B: Route by Domain (Recommended)
**Flow:** All messages → `wa-webhook-core` → Route to specialized services

```
WhatsApp → wa-webhook-core (router)
             ├→ wa-webhook (insurance, vendor, general)
             ├→ wa-webhook-ai-agents (AI intents)
             ├→ wa-webhook-mobility (rides, nearby)
             ├→ wa-webhook-wallet (wallet ops)
             ├→ wa-webhook-jobs (job board)
             └→ wa-webhook-property (property rentals)
```

**Implementation:**
1. Configure WhatsApp webhook URL to point to `wa-webhook-core`
2. `wa-webhook-core` examines message state/intent
3. Routes to appropriate service
4. Each service responds independently

**Pros:**
- Smaller, faster functions
- Independent scaling
- Domain isolation

**Cons:**
- More complex routing logic
- Need state/intent detection in core

---

## Deployment Optimization

### Current Waste (Past 48h)

| Deployment | Services | Actually Needed | Wasted |
|------------|----------|----------------|--------|
| Insurance fix | 7 | 1 (wa-webhook) | 6 |
| Crypto fix | 7 | 1 (wa-webhook) | 6 |
| Vendor menu fix | 7 | 1 (wa-webhook) | 6 |

**Total deployments:** 21  
**Necessary deployments:** 3  
**Wasted deployments:** 18 (85.7% waste!)

### Recommended Deployment Strategy

```json
{
  "scripts": {
    "deploy:wa-main": "supabase functions deploy wa-webhook",
    "deploy:wa-router": "supabase functions deploy wa-webhook-core",
    "deploy:wa-ai": "supabase functions deploy wa-webhook-ai-agents",
    "deploy:wa-mobility": "supabase functions deploy wa-webhook-mobility",
    "deploy:wa-wallet": "supabase functions deploy wa-webhook-wallet",
    "deploy:wa-jobs": "supabase functions deploy wa-webhook-jobs",
    "deploy:wa-property": "supabase functions deploy wa-webhook-property",
    "deploy:wa-all": "supabase functions deploy wa-webhook wa-webhook-core wa-webhook-ai-agents wa-webhook-mobility wa-webhook-wallet wa-webhook-jobs wa-webhook-property"
  }
}
```

**Use:**
- `deploy:wa-main` - When editing `wa-webhook/` code (insurance, vendor, etc.)
- `deploy:wa-router` - When editing routing logic in `wa-webhook-core`
- `deploy:wa-mobility` - When editing mobility code
- `deploy:wa-all` - Only when changing `_shared/` code

---

## Action Items

### Immediate (Next Deployment)
1. ✅ Update `package.json` with separate deploy commands
2. ✅ Document which service contains what logic
3. ✅ Only deploy `wa-webhook` for insurance/vendor changes

### Short Term (This Week)
1. ❌ Move WhatsApp webhook URL to `wa-webhook-core`
2. ❌ Implement routing logic in core
3. ❌ Test domain-based routing

### Long Term (Next Sprint)
1. ❌ Split `wa-webhook` into smaller domain services
2. ❌ Extract shared code into libraries
3. ❌ Implement proper service mesh

---

## Current Status

**What's Actually Receiving Messages:**
- `wa-webhook` (v535) ← **PRIMARY ENDPOINT**

**What Should Be Routing (Not Used Yet):**
- `wa-webhook-core` (v212) ← Has routing logic, not active

**Specialized Services (Standalone, Not Routed To):**
- `wa-webhook-ai-agents` (v164)
- `wa-webhook-mobility` (v131)
- `wa-webhook-wallet` (v57)
- `wa-webhook-jobs` (v133)
- `wa-webhook-property` (v112)

---

## Conclusion

**Current Reality:**
- `wa-webhook` is the ONLY function receiving WhatsApp messages
- Other microservices are deployed but NOT actively used for routing
- Recent changes to insurance/vendor ONLY needed `wa-webhook` deployment
- We wasted 18 deployments in 48 hours

**Recommendation:**
1. **Immediately:** Only deploy `wa-webhook` for domain logic changes
2. **Soon:** Activate `wa-webhook-core` as primary router
3. **Later:** Complete microservice split

