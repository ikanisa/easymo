# Phase 4: QA + Observability - Implementation Plan

## Overview

Comprehensive QA and observability implementation for all AI agent workflows across EasyMO platform.

**Status**: In Progress  
**Last Updated**: 2025-11-11  
**Owner**: Platform Team

---

## 1. Regression Test Checklist

### 1.1 UI Regression Tests

#### Admin Dashboard

- [ ] Dashboard loads without errors
- [ ] All agent cards display correctly
- [ ] Real-time monitoring connects
- [ ] Session list pagination works
- [ ] Quote details modal functions
- [ ] Filters apply correctly
- [ ] Export features work

#### Agent Dashboards (Per Agent)

- [ ] Driver Negotiation dashboard
- [ ] Pharmacy Orders dashboard
- [ ] Shops & Services dashboard
- [ ] Hardware/Quincaillerie dashboard
- [ ] Property Rental dashboard
- [ ] Schedule Trip dashboard
- [ ] Marketplace dashboard
- [ ] Fuel Delivery dashboard
- [ ] Food Delivery dashboard
- [ ] Grocery Delivery dashboard
- [ ] Laundry Services dashboard
- [ ] Car Wash dashboard
- [ ] Salon/Beauty dashboard
- [ ] Home Cleaning dashboard
- [ ] Tutoring dashboard

#### Station App

- [ ] Driver view loads
- [ ] Request acceptance flow
- [ ] Quote submission works
- [ ] Status updates properly

### 1.2 API Regression Tests

#### Core APIs

```bash
# Test all agent APIs
./scripts/test-agent-apis.sh

# Expected endpoints:
GET  /api/agents/sessions
GET  /api/agents/quotes
POST /api/agents/driver-requests
POST /api/agents/pharmacy-orders
POST /api/agents/shops-requests
POST /api/agents/hardware-requests
POST /api/agents/property-rentals
POST /api/agents/scheduled-trips
POST /api/agents/marketplace-intents
POST /api/agents/fuel-deliveries
POST /api/agents/food-orders
POST /api/agents/grocery-orders
POST /api/agents/laundry-requests
POST /api/agents/carwash-bookings
POST /api/agents/beauty-bookings
POST /api/agents/cleaning-requests
POST /api/agents/tutoring-requests
```

### 1.3 WhatsApp End-to-End Tests

#### Flow Templates by Agent

1. **Driver Negotiation**
   - Trigger: User sends location
   - Expected: Agent finds nearby drivers
   - Fallback: Show top 10 by rating

2. **Pharmacy Orders**
   - Trigger: User requests medicine
   - Expected: Agent finds nearby pharmacies
   - Fallback: Show ranked pharmacy list

3. **Shops & Services**
   - Trigger: User looks for product/service
   - Expected: AI matches vendors
   - Fallback: Top 10 by rating

4. **Hardware/Quincaillerie**
   - Trigger: User requests construction materials
   - Expected: Agent finds suppliers
   - Fallback: Ranked supplier list

5. **Property Rental**
   - Trigger: User searches for property
   - Expected: Agent filters listings
   - Fallback: Show all matching properties

6. **Schedule Trip**
   - Trigger: User schedules future ride
   - Expected: Agent creates booking
   - Fallback: Manual driver assignment

7. **Marketplace**
   - Trigger: User browses products
   - Expected: AI recommendations
   - Fallback: Category-based listing

8. **Fuel Delivery**
   - Trigger: User requests fuel
   - Expected: Agent finds providers
   - Fallback: Ranked provider list

9. **Food Delivery**
   - Trigger: User orders food
   - Expected: Agent matches restaurants
   - Fallback: Popular restaurants list

10. **Grocery Delivery**
    - Trigger: User requests groceries
    - Expected: Agent finds stores
    - Fallback: Nearby stores list

11. **Laundry Services**
    - Trigger: User books laundry
    - Expected: Agent finds laundries
    - Fallback: Ranked laundry list

12. **Car Wash**
    - Trigger: User books car wash
    - Expected: Agent finds services
    - Fallback: Nearby car wash list

13. **Salon/Beauty**
    - Trigger: User books appointment
    - Expected: Agent finds salons
    - Fallback: Ranked salon list

14. **Home Cleaning**
    - Trigger: User requests cleaning
    - Expected: Agent finds cleaners
    - Fallback: Verified cleaner list

15. **Tutoring**
    - Trigger: User requests tutor
    - Expected: Agent matches tutors
    - Fallback: Qualified tutor list

---

## 2. Observability Infrastructure

### 2.1 Structured Logging (IMPLEMENTED)

**Base Implementation**: `supabase/functions/_shared/observability.ts` **Agent-Specific**:
`supabase/functions/_shared/agent-observability.ts`

#### Key Functions

```typescript
// Event logging
logStructuredEvent(event: string, details: object)
logAgentEvent(event: AgentEventType, details: object)

// Error tracking
logError(scope: string, error: unknown, context: object)
logAgentError(scope: string, error: unknown, context: object)

// Request/response logging
logRequest(scope: string, req: Request, extra: object)
logResponse(scope: string, status: number, extra: object)

// PII masking
maskPII(value: string, visibleStart: number, visibleEnd: number)
maskIdentifier(id: string)
maskPhone(phone: string)
```

### 2.2 Metrics Collection (IN PROGRESS)

#### Current Implementation

- Admin App: `admin-app/lib/server/metrics.ts`
- Supabase: `supabase/functions/wa-webhook/observe/metrics.ts`

#### Required Metrics per Agent

**Session Metrics**

- `agent.session.created` - Counter
- `agent.session.completed` - Counter
- `agent.session.timeout` - Counter
- `agent.session.cancelled` - Counter
- `agent.session.duration` - Histogram

**Quote Metrics**

- `agent.quote.sent` - Counter
- `agent.quote.received` - Counter
- `agent.quote.accepted` - Counter
- `agent.quote.rejected` - Counter
- `agent.quote.expired` - Counter

**Vendor Metrics**

- `agent.vendor.contacted` - Counter
- `agent.vendor.responded` - Counter
- `agent.vendor.timeout` - Counter

**Fallback Metrics**

- `agent.fallback.triggered` - Counter (with reason tag)
- `agent.fallback.type` - Counter (ranking/mock/supabase)

**Performance Metrics**

- `agent.negotiation.duration` - Histogram
- `agent.response.time` - Histogram
- `agent.ai.latency` - Histogram

### 2.3 Alerts & Monitoring

#### Critical Alerts

1. **Agent Session Failure Rate > 5%**
   - Check: WhatsApp webhook health
   - Check: Supabase function errors
   - Check: AI service availability

2. **Quote Timeout Rate > 20%**
   - Check: Vendor notification delivery
   - Check: Network latency
   - Check: Database performance

3. **Fallback Rate > 30%**
   - Check: AI service health
   - Check: Ranking service availability
   - Check: Mock data freshness

4. **WhatsApp Message Failure > 2%**
   - Check: WhatsApp API status
   - Check: Template approvals
   - Check: Rate limits

#### Monitoring Dashboards

- **Supabase Dashboard**: Function logs and metrics
- **Admin Panel**: Real-time agent monitoring
- **Grafana** (Future): Custom dashboards
- **Sentry** (Future): Error tracking

---

## 3. Synthetic Failure Tests

### 3.1 Test Scenarios

#### Scenario 1: AI Service Unavailable

```typescript
// Force AI path to fail
test("falls back to ranking when AI fails", async () => {
  // Mock AI service error
  mockAIService.searchVendors = () => {
    throw new Error("AI_UNAVAILABLE");
  };

  // Trigger workflow
  const result = await triggerAgent("shops", userRequest);

  // Assert fallback triggered
  expect(result.fallbackUsed).toBe(true);
  expect(result.fallbackType).toBe("ranking");
  expect(result.vendors).toHaveLength(10);
  expect(result.userMessage).toContain("top-rated");
});
```

#### Scenario 2: Database Connection Lost

```typescript
test("handles database failures gracefully", async () => {
  // Mock database error
  mockSupabase.from = () => {
    throw new Error("DB_CONNECTION_LOST");
  };

  // Trigger workflow
  const result = await triggerAgent("pharmacy", userRequest);

  // Assert graceful degradation
  expect(result.error).toBeDefined();
  expect(result.userMessage).toContain("try again");
  expect(result.retryable).toBe(true);
});
```

#### Scenario 3: Vendor Notification Failure

```typescript
test("tracks vendor notification failures", async () => {
  // Mock WhatsApp send failure
  mockWhatsApp.sendMessage = () => {
    throw new Error("RATE_LIMIT");
  };

  // Trigger workflow
  const result = await triggerAgent("driver", userRequest);

  // Assert error logged and fallback triggered
  expect(result.notificationsFailed).toBeGreaterThan(0);
  expect(result.fallbackUsed).toBe(true);
  expect(metrics.vendorNotificationFailure).toHaveBeenCalled();
});
```

#### Scenario 4: Timeout Before Any Quotes

```typescript
test("shows fallback when no quotes arrive", async () => {
  // Mock slow/no vendor responses
  mockVendors.forEach((v) => (v.responseTime = Infinity));

  // Trigger workflow with short timeout
  const result = await triggerAgent("hardware", userRequest, { timeout: 1000 });

  // Assert timeout handling
  expect(result.quotesReceived).toBe(0);
  expect(result.fallbackUsed).toBe(true);
  expect(result.userMessage).toContain("top vendors");
});
```

#### Scenario 5: Partial Quote Collection

```typescript
test("presents partial results on timeout", async () => {
  // Mock some vendors responding, others not
  mockVendors[0].responseTime = 500;
  mockVendors[1].responseTime = 600;
  mockVendors.slice(2).forEach((v) => (v.responseTime = Infinity));

  // Trigger workflow
  const result = await triggerAgent("shops", userRequest, { timeout: 1000 });

  // Assert partial results shown
  expect(result.quotesReceived).toBe(2);
  expect(result.partialResults).toBe(true);
  expect(result.userMessage).toContain("so far");
});
```

### 3.2 Test Implementation Script

Create: `tests/synthetic-failures.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { triggerAgent, mockServices } from "./test-utils";

describe("Synthetic Failure Tests", () => {
  beforeEach(() => {
    mockServices.reset();
  });

  afterEach(() => {
    mockServices.restore();
  });

  // Add all scenario tests here
});
```

---

## 4. WhatsApp Integration Validation

### 4.1 Template Audit

Run: `./scripts/audit-wa-templates.sh`

#### Required Templates per Agent

1. Driver: `driver_quote_request`, `driver_quote_received`, `driver_trip_confirmed`
2. Pharmacy: `pharmacy_order_request`, `pharmacy_quote`, `pharmacy_delivery_update`
3. Shops: `shops_search_request`, `shops_vendor_list`, `shops_quote`
4. Hardware: `hardware_request`, `hardware_vendor_list`, `hardware_quote`
5. Property: `property_search`, `property_listing`, `property_contact`
6. Schedule: `trip_scheduled`, `trip_reminder`, `trip_confirmed`
7. Marketplace: `marketplace_browse`, `marketplace_recommendation`
8. Fuel: `fuel_request`, `fuel_provider_list`, `fuel_delivery_update`
9. Food: `food_order`, `food_restaurant_menu`, `food_delivery_status`
10. Grocery: `grocery_list`, `grocery_store_options`, `grocery_delivery`
11. Laundry: `laundry_booking`, `laundry_pickup_scheduled`, `laundry_ready`
12. Car Wash: `carwash_booking`, `carwash_service_options`, `carwash_confirmed`
13. Beauty: `beauty_booking`, `beauty_service_menu`, `beauty_confirmed`
14. Cleaning: `cleaning_request`, `cleaning_provider_list`, `cleaning_scheduled`
15. Tutoring: `tutor_request`, `tutor_profile`, `tutoring_session_booked`

### 4.2 Webhook Health Check

Run: `./scripts/check-wa-webhook.sh`

Expected checks:

- Webhook responds to GET with challenge
- Webhook accepts POST with valid signature
- Webhook rejects POST with invalid signature
- Webhook routes messages to correct agent
- Webhook handles rate limits gracefully

### 4.3 Message Flow Validation

For each agent, test:

1. User message → Webhook → Agent function → AI/Fallback → Response
2. Verify correlation IDs propagate through stack
3. Verify all events logged with structured data
4. Verify metrics recorded at each step

---

## 5. Performance Benchmarks

### 5.1 Target Metrics

| Metric                    | Target  | P95   | P99 |
| ------------------------- | ------- | ----- | --- |
| Agent session creation    | < 500ms | 1s    | 2s  |
| AI vendor search          | < 2s    | 4s    | 6s  |
| Fallback activation       | < 300ms | 500ms | 1s  |
| WhatsApp message send     | < 1s    | 2s    | 3s  |
| Quote collection window   | 5min    | -     | -   |
| Partial results presented | 2min    | -     | -   |

### 5.2 Load Testing

Run: `./scripts/load-test-agents.sh`

Simulate:

- 100 concurrent users per agent
- 1000 requests per minute peak
- Sustained load for 10 minutes

Monitor:

- Response times
- Error rates
- Fallback rates
- Database connections
- Memory usage

---

## 6. Feature Flags & Config

### 6.1 Agent Feature Flags

File: `config/agent-features.json`

```json
{
  "driver_negotiation": { "enabled": true, "ai_enabled": true },
  "pharmacy_orders": { "enabled": true, "ai_enabled": true },
  "shops_services": { "enabled": true, "ai_enabled": true },
  "hardware": { "enabled": true, "ai_enabled": true },
  "property_rental": { "enabled": true, "ai_enabled": true },
  "schedule_trip": { "enabled": true, "ai_enabled": true },
  "marketplace": { "enabled": true, "ai_enabled": true },
  "fuel_delivery": { "enabled": false, "ai_enabled": false },
  "food_delivery": { "enabled": false, "ai_enabled": false },
  "grocery_delivery": { "enabled": false, "ai_enabled": false },
  "laundry_services": { "enabled": false, "ai_enabled": false },
  "car_wash": { "enabled": false, "ai_enabled": false },
  "beauty_salon": { "enabled": false, "ai_enabled": false },
  "home_cleaning": { "enabled": false, "ai_enabled": false },
  "tutoring": { "enabled": false, "ai_enabled": false }
}
```

### 6.2 Environment Configuration

Required ENV vars per deployment:

```bash
# Supabase Functions
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
AI_SERVICE_URL=
AI_SERVICE_TOKEN=
METRICS_DRAIN_URL=

# Admin App
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ADMIN_SESSION_SECRET=
```

---

## 7. Rollout Checklist

### Pre-Deployment

- [ ] All regression tests passing
- [ ] Synthetic failure tests passing
- [ ] WhatsApp templates approved
- [ ] Feature flags configured
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Mock/seed data loaded

### Deployment

- [ ] Deploy Supabase functions
- [ ] Deploy admin app
- [ ] Deploy station app
- [ ] Verify health checks
- [ ] Test smoke scenarios
- [ ] Monitor error rates

### Post-Deployment

- [ ] Run end-to-end tests
- [ ] Verify metrics flowing
- [ ] Check alert configurations
- [ ] Review logs for errors
- [ ] Test rollback procedure

### Monitoring (First 24h)

- [ ] Session creation rate
- [ ] Quote acceptance rate
- [ ] Fallback activation rate
- [ ] Error rate by agent
- [ ] WhatsApp delivery rate
- [ ] User satisfaction (if available)

---

## 8. Rollback Plan

### Trigger Conditions

- Error rate > 10% sustained for 5 minutes
- WhatsApp webhook failures > 5%
- Database connection failures
- Critical agent completely broken

### Rollback Steps

1. Disable affected agent via feature flag
2. Revert Supabase function deployment
3. Revert admin app deployment
4. Verify previous version working
5. Notify users of service restoration
6. Post-mortem within 24 hours

---

## 9. Documentation Updates

### Update Files

- [ ] `README.md` - Agent list and status
- [ ] `docs/ARCHITECTURE.md` - Agent architecture
- [ ] `docs/GROUND_RULES.md` - Observability examples
- [ ] `admin-app/README.md` - Dashboard features
- [ ] Each agent's README - Setup and testing

### API Documentation

- [ ] Update OpenAPI specs
- [ ] Document webhook signatures
- [ ] Document feature flags
- [ ] Document fallback behavior

---

## 10. Next Steps

After Phase 4 completion:

1. **Phase 5: Cutover Readiness**
   - Final UX polish
   - Release notes preparation
   - Staging smoke tests
   - Production cutover plan

2. **Future Enhancements**
   - Grafana dashboards
   - Sentry error tracking
   - A/B testing framework
   - ML-based ranking improvements
   - Advanced agent orchestration

---

## Appendix: Quick Command Reference

```bash
# Run all tests
pnpm test

# Run admin app tests
cd admin-app && npm test -- --run

# Run agent API tests
./test-ai-agents.sh

# Check WhatsApp webhook
./scripts/check-wa-webhook.sh

# Audit templates
./scripts/audit-wa-templates.sh

# Load test agents
./scripts/load-test-agents.sh

# View metrics (Supabase)
supabase functions logs wa-webhook --project-ref lhbowpbcpwoiparwnwgt

# Monitor real-time (Admin App)
# Navigate to http://localhost:3000/agents/dashboard
```

---

**Document Version**: 1.0  
**Last Review**: 2025-11-11  
**Next Review**: After Phase 4 completion
