# 🎯 Traffic Routing Implementation Guide

**Created**: 2025-11-15  
**Purpose**: Route traffic from main wa-webhook to microservices  
**Status**: ✅ Router created, ready for integration  

---

## Overview

All 7 microservices are deployed and healthy. This guide shows how to route traffic from the main `wa-webhook` to the appropriate microservice.

## Architecture

```
WhatsApp → wa-webhook (router) → Microservices
                                ├─ wa-webhook-jobs
                                ├─ wa-webhook-mobility
                                ├─ wa-webhook-property
                                ├─ wa-webhook-marketplace
                                ├─ wa-webhook-wallet
                                ├─ wa-webhook-ai-agents
                                └─ wa-webhook-core (fallback)
```

## Router Features

The router (`supabase/functions/wa-webhook/router.ts`) provides:

1. **Keyword-based routing**: Routes based on message content
2. **State-based routing**: Routes based on user's current flow
3. **Priority system**: Handles overlapping keywords
4. **Fallback**: Routes unknown messages to core service
5. **Health checks**: Monitors all microservices

## Routing Rules

| Service | Keywords | Priority |
|---------|----------|----------|
| jobs | job, work, employment, hire, career, apply, cv, resume | 1 (High) |
| mobility | ride, trip, driver, taxi, transport, schedule, book, nearby | 1 (High) |
| property | property, rent, house, apartment, rental, landlord, tenant | 1 (High) |
| wallet | wallet, payment, pay, balance, deposit, withdraw, money | 1 (High) |
| marketplace | buy, sell, marketplace, shop, product, listing | 2 (Medium) |
| ai-agents | agent, chat, help, support, ask | 3 (Low) |
| core | *fallback for all other messages* | Default |

## Implementation Steps

### Phase 1: Testing Router (Today - 1 hour)

```typescript
// In wa-webhook/index.ts, add:
import { routeMessage, forwardToMicroservice } from "./router.ts";

// In message handler:
const service = await routeMessage(messageText, chatState);
console.log(`Routing to: ${service}`);
const response = await forwardToMicroservice(service, payload, req.headers);
```

Test with sample messages:
```bash
# Jobs message
"I need a job" → wa-webhook-jobs

# Mobility message  
"Book a ride" → wa-webhook-mobility

# Unknown message
"Hello" → wa-webhook-core
```

### Phase 2: Gradual Rollout (Week 2)

#### Day 1-2: 10% Traffic
```typescript
// Route 10% of traffic to microservices
const useNewRouting = Math.random() < 0.10;

if (useNewRouting) {
  const service = await routeMessage(messageText, chatState);
  return await forwardToMicroservice(service, payload, req.headers);
} else {
  // Existing monolith logic
}
```

Monitor:
- Response times
- Error rates
- Service health

#### Day 3-4: 50% Traffic
```typescript
const useNewRouting = Math.random() < 0.50;
```

#### Day 5+: 100% Traffic
```typescript
// Remove feature flag, always use new routing
const service = await routeMessage(messageText, chatState);
return await forwardToMicroservice(service, payload, req.headers);
```

### Phase 3: Monitoring (Ongoing)

```typescript
// In wa-webhook/index.ts health check:
import { getAllServicesHealth } from "./router.ts";

if (url.pathname === "/health") {
  const servicesHealth = await getAllServicesHealth();
  return new Response(JSON.stringify({
    status: "healthy",
    service: "wa-webhook-router",
    microservices: servicesHealth,
    timestamp: new Date().toISOString(),
  }));
}
```

---

## Testing

### Test Router Locally

```bash
cd supabase/functions/wa-webhook

# Test routing logic
deno test router.test.ts

# Test with sample payloads
deno run --allow-net test-router.ts
```

### Test Messages

```typescript
// Job search
routeMessage("I'm looking for a job") 
// → wa-webhook-jobs

// Book ride
routeMessage("I need a taxi to town")
// → wa-webhook-mobility

// Rent property
routeMessage("I want to rent a house")
// → wa-webhook-property

// Buy item
routeMessage("I want to buy a phone")
// → wa-webhook-marketplace

// Check balance
routeMessage("What's my wallet balance?")
// → wa-webhook-wallet

// General help
routeMessage("Hello, can you help me?")
// → wa-webhook-ai-agents

// Unknown
routeMessage("Random text")
// → wa-webhook-core
```

---

## Rollback Plan

If issues occur during rollout:

```typescript
// Immediate: Set traffic to 0%
const useNewRouting = false;

// Or: Route specific domains back to monolith
const DISABLED_SERVICES = ["wa-webhook-jobs"]; // Temporarily disable
if (DISABLED_SERVICES.includes(service)) {
  // Use monolith logic
}
```

---

## Monitoring Dashboard

Check service health:
```bash
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook/health
```

Response:
```json
{
  "status": "healthy",
  "service": "wa-webhook-router",
  "microservices": {
    "wa-webhook-jobs": true,
    "wa-webhook-mobility": true,
    "wa-webhook-property": true,
    "wa-webhook-marketplace": true,
    "wa-webhook-wallet": true,
    "wa-webhook-ai-agents": true,
    "wa-webhook-core": true
  },
  "timestamp": "2025-11-15T09:00:00.000Z"
}
```

---

## Success Metrics

Track these metrics during rollout:

| Metric | Target | Monitor |
|--------|--------|---------|
| Routing accuracy | >95% | Log routing decisions |
| Response time | <500ms | Compare before/after |
| Error rate | <1% | Track failed routes |
| Service health | 100% | All services healthy |
| User satisfaction | >90% | Monitor complaints |

---

## Next Steps

1. **Test router logic** (30 min)
   - Unit tests
   - Integration tests

2. **Deploy with 10% traffic** (Tomorrow)
   - Update wa-webhook/index.ts
   - Deploy and monitor

3. **Gradual increase** (Week 2)
   - 50% on Day 3
   - 100% on Day 5

4. **Cleanup** (Week 3)
   - Remove old monolith code
   - Optimize routing logic

---

## Support

- **Documentation**: WA_WEBHOOK_SPLIT_COMPLETE.md
- **Architecture**: WA_WEBHOOK_SPLIT_VISUAL.txt
- **Quick Reference**: WA_WEBHOOK_SPLIT_QUICKSTART.md
- **Dashboard**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions

---

**Status**: ✅ Router ready for integration  
**All Services**: ✅ Healthy and operational  
**Ready for**: Phase 1 testing and gradual rollout
