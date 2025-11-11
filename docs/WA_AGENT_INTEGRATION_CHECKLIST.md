# WhatsApp Agent Integration Checklist
## Phase 3: Exercise and Harden Fallbacks

This checklist validates that every AI agent is properly integrated with WhatsApp workflows and has robust fallback handling.

## Pre-Flight Checks

- [ ] Supabase project is accessible
- [ ] WhatsApp Business API credentials configured
- [ ] Edge functions deployed (`supabase functions deploy`)
- [ ] Environment variables set (SERVICE_ROLE_KEY, WA_WEBHOOK_TOKEN)
- [ ] Test phone numbers whitelisted

## Agent-by-Agent Validation

### 1. Driver Negotiation Agent

**Location:** `supabase/functions/agent-negotiation/`

**WhatsApp Flow:**
1. User sends ride request: "Need ride from Kigali to Airport"
2. Webhook → `wa-webhook` → triggers agent
3. Agent processes → orchestrates drivers
4. Response sent via WA template

**Tests:**
- [ ] Incoming message triggers agent
- [ ] AI path returns driver recommendations
- [ ] Fallback 1: Ranking service returns top drivers
- [ ] Fallback 2: Supabase query returns available drivers  
- [ ] Fallback 3: Mock driver data returned
- [ ] WA template renders correctly
- [ ] Error message sent if all fail

**Expected Response:**
```
🚗 Available Drivers:
1. John Doe - Toyota Corolla - 5000 RWF
2. Jane Smith - Honda Fit - 4500 RWF
Reply with driver number to book
```

**Validation Command:**
```bash
curl -X POST https://[project].supabase.co/functions/v1/agent-negotiation \
  -H "Authorization: Bearer $ANON_KEY" \
  -d '{"phoneNumber":"+250788123456","message":"Need ride from Kigali to Airport"}'
```

---

### 2. Pharmacy Agent

**Location:** `supabase/functions/agents/pharmacy`

**WhatsApp Flow:**
1. User: "Need Amoxicillin 500mg and Paracetamol"
2. Agent processes medication request
3. Queries pharmacy vendors
4. Returns quotes via WA

**Tests:**
- [ ] Medication parsing works
- [ ] Pharmacy queries executed
- [ ] Fallback: Supabase pharmacy_requests table
- [ ] Fallback: Mock pharmacy data
- [ ] Quote comparison displayed
- [ ] Stock status included

**Expected Response:**
```
💊 Pharmacy Quotes:
1. CityPharma - 18,500 RWF (35 min) ✅ In stock
2. Nyamirambo Health - 19,000 RWF (50 min) ⚠️ Limited
Reply with number to order
```

---

### 3. Shops & Services Agent

**Location:** `supabase/functions/agent-shops/`

**WhatsApp Flow:**
1. User: "Find plumber in Kacyiru"
2. Agent searches shops/services
3. Returns top 10 ranked results
4. User can book directly

**Tests:**
- [ ] Location parsing works
- [ ] AI ranking returns top 10
- [ ] Fallback: Supabase shops with location filter
- [ ] Fallback: Mock shop data
- [ ] Contact info included
- [ ] Rating/reviews shown

**Expected Response:**
```
🔧 Plumbers in Kacyiru:
1. Expert Plumbing ⭐4.8 - 078...
2. Quick Fix Services ⭐4.6 - 078...
3. Kigali Plumbers ⭐4.5 - 078...
...
Reply with number for details
```

---

### 4. Hardware/Quincaillerie Agent

**Location:** `supabase/functions/agent-quincaillerie/`

**WhatsApp Flow:**
1. User: "Need hammer and nails"
2. Agent searches hardware catalog
3. Returns products with prices
4. Links to purchase

**Tests:**
- [ ] Product search works
- [ ] AI catalog search ranking
- [ ] Fallback: Supabase products table
- [ ] Fallback: Mock hardware catalog
- [ ] Prices in local currency
- [ ] Stock availability shown

---

### 5. Property Rental Agent

**Location:** `supabase/functions/agent-property-rental/`

**WhatsApp Flow:**
1. User: "Looking for 2BR apartment in Kimironko"
2. Agent searches properties
3. Returns matching listings
4. Schedules viewings

**Tests:**
- [ ] Property search parameters parsed
- [ ] Supabase properties queried
- [ ] Fallback: Mock property listings
- [ ] Images/details included
- [ ] Contact landlord option
- [ ] Price filtering works

---

### 6. Schedule Trip Agent

**Location:** `supabase/functions/agent-schedule-trip/`

**WhatsApp Flow:**
1. User: "Bus to Huye tomorrow 8am"
2. Agent queries schedules
3. Returns available buses
4. Books seat

**Tests:**
- [ ] Date/time parsing works
- [ ] Route matching accurate
- [ ] Supabase schedules queried
- [ ] Fallback: Standard schedules
- [ ] Seat availability shown
- [ ] Booking confirmation sent

---

### 7. Marketplace Agent

**Location:** `supabase/functions/agents/marketplace`

**WhatsApp Flow:**
1. User: "Selling iPhone 12"
2. Agent creates listing
3. Matches with buyers
4. Facilitates transaction

**Tests:**
- [ ] Listing creation works
- [ ] AI categorization correct
- [ ] Price suggestion given
- [ ] Buyer matching works
- [ ] Fallback: Category browse
- [ ] Payment integration

---

### 8-15. Additional Agents

**Video Analysis, Insurance OCR, MoMo Allocation, Agent Chat, Agent Runner, Agent Monitor, Contact Queue, Customer Lookup**

Each follows similar validation pattern:
- [ ] Trigger mechanism validated
- [ ] Primary AI path tested
- [ ] Fallback 1 tested
- [ ] Fallback 2 tested
- [ ] Mock data fallback tested
- [ ] Error handling validated
- [ ] User messaging appropriate

---

## Fallback Testing Protocol

For each agent, run synthetic failure tests:

### Test 1: Force AI Failure
```bash
# Set environment variable to force AI path to fail
export FORCE_AGENT_FAILURE=true
# Send test message
# Verify fallback 1 (ranking) triggers
```

### Test 2: Force Ranking Failure  
```bash
# Disable ranking service
export RANKING_SERVICE_ENABLED=false
# Verify fallback 2 (Supabase) triggers
```

### Test 3: Force Supabase Failure
```bash
# Use invalid Supabase credentials
export SUPABASE_URL=https://invalid.supabase.co
# Verify fallback 3 (mock data) triggers
```

### Test 4: All Systems Down
```bash
# Disable all services
# Verify graceful error message sent to user
```

---

## Observability Validation

Check that each agent logs correctly:

```sql
-- Query structured logs
SELECT 
  event,
  agent_name,
  fallback_strategy,
  COUNT(*) as occurrences
FROM structured_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND event LIKE 'AGENT_FALLBACK%'
GROUP BY event, agent_name, fallback_strategy
ORDER BY occurrences DESC;
```

**Expected Events:**
- `AGENT_FALLBACK_TRIGGERED` - Fallback initiated
- `AGENT_FALLBACK_SUCCESS` - Fallback worked
- `AGENT_FALLBACK_RANKING_FAILED` - Ranking tier failed
- `AGENT_FALLBACK_SUPABASE_FAILED` - DB tier failed
- `AGENT_FALLBACK_ALL_FAILED` - All tiers failed

---

## Metrics Validation

Check metrics are being recorded:

```bash
# Query metrics (if using Prometheus/similar)
curl http://localhost:9090/api/v1/query \
  -d 'query=agent_fallback_triggered_total{agent_name="driver-negotiation"}[1h]'
```

**Expected Metrics:**
- `agent.{name}.fallback.triggered` - Total fallbacks
- `agent.{name}.fallback.ranking_success` - Ranking worked
- `agent.{name}.fallback.supabase_success` - Supabase worked
- `agent.{name}.fallback.mock_success` - Mock data used
- `agent.{name}.fallback.all_failed` - Complete failure

---

## WhatsApp Template Validation

Ensure all message templates are approved and active:

- [ ] `driver_negotiation_results`
- [ ] `pharmacy_quotes`
- [ ] `shop_results`
- [ ] `hardware_results`
- [ ] `property_results`
- [ ] `trip_schedule_options`
- [ ] `marketplace_results`
- [ ] `agent_error_message`

**Validation:**
```bash
# Check template status via WhatsApp Business API
curl "https://graph.facebook.com/v18.0/$WA_BUSINESS_ID/message_templates" \
  -H "Authorization: Bearer $WA_ACCESS_TOKEN"
```

---

## End-to-End Test Script

Run comprehensive WhatsApp workflow tests:

```bash
#!/bin/bash
# test-wa-agents.sh

# Test each agent with real WhatsApp messages
./scripts/send-wa-message.sh "+250788999000" "Need ride to airport"
./scripts/send-wa-message.sh "+250788999000" "Find pharmacies near me"
./scripts/send-wa-message.sh "+250788999000" "Looking for plumber"
# ... repeat for all agents

# Wait for responses
sleep 10

# Verify responses received
./scripts/check-wa-responses.sh "+250788999000"
```

---

## Sign-Off Checklist

Before declaring Phase 3 complete:

- [ ] All 15 agents validated individually
- [ ] Fallback paths tested for each agent
- [ ] WhatsApp integration confirmed working
- [ ] Observability logs verified
- [ ] Metrics collection confirmed
- [ ] User-friendly error messages tested
- [ ] Synthetic failure tests passing
- [ ] Documentation updated
- [ ] Staging environment validated
- [ ] Team demo completed

---

## Issues & Resolutions

| Agent | Issue | Resolution | Status |
|-------|-------|------------|--------|
| Driver Negotiation | - | - | ✅ |
| Pharmacy | - | - | ✅ |
| Shops & Services | - | - | ✅ |
| ... | | | |

---

**Last Updated:** 2025-11-11  
**Phase 3 Status:** ✅ Implementation Complete - Validation In Progress
**Next Phase:** Phase 4 - QA + Observability
