# Agent Orchestration Foundation - Phase 1 Implementation

## Overview

This document describes the Phase 1 foundation for transforming EasyMO into an AI-agent-first WhatsApp platform. The implementation enables autonomous agents to negotiate with drivers and vendors, collecting multiple quotes within 5-minute windows.

## Architecture

### Database Schema

#### agent_sessions Table
Tracks negotiation sessions with time-bound windows.

**Key Columns:**
- `id`: UUID primary key
- `user_id`: References profiles (user initiating the negotiation)
- `flow_type`: Type of negotiation (nearby_drivers, nearby_pharmacies, etc.)
- `status`: Session state machine (searching, negotiating, presenting, completed, timeout, cancelled, error)
- `started_at`: Session start time
- `deadline_at`: Deadline for quote collection (typically start + 5 minutes)
- `quotes_collected`: JSONB array of collected quotes
- `request_data`: JSONB containing flow-specific request details

**Status Flow:**
```
searching → negotiating → presenting → completed
                       ↘ timeout
                       ↘ cancelled
                       ↘ error
```

#### agent_quotes Table
Individual quotes from vendors during negotiation sessions.

**Key Columns:**
- `id`: UUID primary key
- `session_id`: References agent_sessions
- `vendor_id`: Optional reference to profiles (vendor providing quote)
- `vendor_type`: Type of vendor (driver, pharmacy, quincaillerie, shop, restaurant, other)
- `offer_data`: JSONB containing vendor-specific offer details
- `status`: Quote status (pending, received, accepted, rejected, expired, withdrawn)
- `price_amount`: Numeric price
- `estimated_time_minutes`: Estimated delivery/arrival time
- `received_at`: When quote was received
- `expires_at`: Quote expiration time

#### trips Table Extensions
Added columns to support scheduled and recurring trips:
- `scheduled_at`: Timestamp for one-time scheduled trips
- `recurrence_rule`: Pattern for recurring trips (e.g., "daily_7am", "weekdays_5pm")
- `auto_match_enabled`: Whether agent should automatically negotiate
- `agent_session_id`: Links trip to the agent session that matched it

### Helper Functions

#### is_agent_session_expired(session_id UUID) → BOOLEAN
Checks if a session has passed its deadline while still in active status.

#### get_expiring_agent_sessions(minutes_threshold INTEGER) → TABLE
Returns sessions approaching their deadline within specified minutes.
Used by background workers to send "need more time?" prompts.

Returns:
- session_id
- user_id
- flow_type
- status
- deadline_at
- minutes_remaining
- quotes_count

## Service Layer

### Agent Orchestrator Module
Location: `services/agent-core/src/modules/orchestrator/`

#### OrchestratorService
Main orchestration service for AI-agent-first negotiation flows.

**Key Methods:**
- `startNegotiation(request)`: Create session and initiate vendor discovery
- `getNegotiationResult(sessionId)`: Get current state of negotiation
- `completeNegotiation(sessionId, quoteId)`: Accept a quote and finalize
- `cancelNegotiation(sessionId, reason)`: Cancel ongoing negotiation
- `monitorExpiringSessions()`: Background task for deadline monitoring
- `timeoutExpiredSessions()`: Background task for handling timeouts

#### SessionManagerService
Manages agent negotiation session lifecycle.

**Key Methods:**
- `createSession(request)`: Create new session with deadline
- `updateSessionStatus(sessionId, status, resultData)`: Update session state
- `isSessionExpired(sessionId)`: Check if deadline passed
- `getExpiringSessions(minutesThreshold)`: Get sessions nearing deadline
- `cancelSession(sessionId, reason)`: Cancel a session
- `timeoutSession(sessionId)`: Mark session as timed out

**5-Minute Window Management:**
Sessions automatically set deadline to `now + windowMinutes` (default 5).
Background workers monitor expiring sessions and can:
1. Prompt user: "I have 2 quotes so far. Need more time?"
2. Present partial results if timeout
3. Auto-complete if minimum quotes received

#### QuoteAggregatorService
Collects, aggregates, and ranks quotes from multiple vendors.

**Key Methods:**
- `addQuote(request)`: Record a new vendor quote
- `getSessionQuotes(sessionId)`: Get all quotes for session
- `getBestQuotes(sessionId, limit)`: Get top-ranked quotes
- `acceptQuote(quoteId, sessionId)`: Mark quote as accepted
- `expireOldQuotes()`: Background task to expire old quotes

**Ranking Algorithm:**
1. Price (lower is better)
2. Estimated time (faster is better)
3. Vendor rating (future enhancement)

## Feature Flags

All new agent capabilities are controlled by feature flags (default OFF):

### Node.js Services
Located in `packages/commons/src/feature-flags.ts`

```typescript
FEATURE_AGENT_NEGOTIATION=false  // Enable negotiation flows
FEATURE_AGENT_SCHEDULING=false   // Enable scheduled trips
FEATURE_AGENT_MARKETPLACE=false  // Enable marketplace agents
FEATURE_AGENT_WAITER=false       // Enable conversational AI waiter
```

### Supabase Edge Functions
Located in `supabase/functions/_shared/feature-flags.ts`

Same flags available with matching names.

### Usage

```typescript
// Node.js
import { isFeatureEnabled } from "@easymo/commons";

if (isFeatureEnabled("agent.negotiation")) {
  await orchestrator.startNegotiation({...});
}

// Deno Edge Function
import { isFeatureEnabled } from "../_shared/feature-flags.ts";

if (isFeatureEnabled("agent.negotiation")) {
  // Handle agent flow
}
```

## Observability

### Agent-Specific Event Types
Location: `supabase/functions/_shared/agent-observability.ts`

18 structured event types for agent operations:
- `AGENT_SESSION_CREATED`
- `AGENT_SESSION_STATUS_CHANGED`
- `AGENT_SESSION_COMPLETED`
- `AGENT_SESSION_TIMEOUT`
- `AGENT_NEGOTIATION_STARTED`
- `AGENT_NEGOTIATION_COMPLETED`
- `AGENT_QUOTE_RECEIVED`
- `AGENT_QUOTE_ACCEPTED`
- `AGENT_VENDOR_CONTACTED`
- And more...

### Helper Functions

```typescript
// Log negotiation start
logNegotiationStart(sessionId, flowType, userId, windowMinutes);

// Log quote received
logQuoteReceived(sessionId, vendorId, vendorType, priceAmount, estimatedTime);

// Log completion
logNegotiationCompleted(sessionId, quotesReceived, selectedQuoteId, timeElapsed);

// Log timeout
logSessionTimeout(sessionId, quotesReceived, partialResultsPresented);
```

### PII Protection

All logging functions automatically mask sensitive data:

```typescript
// Mask identifiers (UUIDs)
maskIdentifier("550e8400-e29b-41d4-a716-446655440000")
// Returns: "550e***0000"

// Mask phone numbers (E.164)
maskPhone("+250788123456")
// Returns: "+250***456"
```

## Security

### Row Level Security (RLS)
All new tables have RLS enabled with policies:

**agent_sessions:**
- Users can view their own sessions
- Service role can view/insert/update all sessions

**agent_quotes:**
- Users can view quotes for their sessions (via JOIN)
- Service role can view/insert/update all quotes

### Environment Variables
Feature flags are server-side only:
- ✅ `FEATURE_AGENT_NEGOTIATION` (no public prefix)
- ❌ `VITE_FEATURE_AGENT_NEGOTIATION` (would fail security check)
- ❌ `NEXT_PUBLIC_FEATURE_AGENT_NEGOTIATION` (would fail security check)

## Next Steps (Phase 2)

### Nearby Drivers Implementation
1. Implement driver negotiation agent
2. Integrate with existing `match_drivers_for_trip_v2` RPC
3. Send WhatsApp quote requests to drivers
4. Parse driver responses and add quotes
5. Present top 3 quotes to user
6. Handle user selection and create trip

### Background Workers
1. Scheduled job to monitor expiring sessions (every minute)
   - Send "need more time?" prompts at T-1 minute
   - Timeout sessions past deadline
2. Scheduled job to expire old quotes (every hour)
3. Integrate with existing job scheduler or pg_cron

### WhatsApp Integration
1. Extend `wa-webhook` to handle agent-initiated messages
2. Add quote request templates
3. Add quote response parsing
4. Add user confirmation flow

### Database Integration
1. Connect orchestrator services to Supabase
2. Implement actual database queries (currently mocked)
3. Add transaction support for quote acceptance
4. Link completed sessions to trips/orders

## Testing

### Current Status
✅ TypeScript compilation (orchestrator module)
✅ Feature flag exports (Node.js + Deno)
✅ Database migration syntax (BEGIN/COMMIT)
✅ Security checks (no service role in client vars)
✅ Vitest tests pass (108 tests)

### TODO Tests
- [ ] Unit tests for SessionManagerService
- [ ] Unit tests for QuoteAggregatorService
- [ ] Unit tests for OrchestratorService
- [ ] Integration tests for database functions
- [ ] E2E tests for agent negotiation flow

## Migration Strategy

### Incremental Rollout
1. **Development**: Enable all flags for testing
2. **Staging**: Enable nearby_drivers flow only
3. **Production Pilot**: Enable for 1% of users
4. **Production Full**: Gradual rollout to 100%

### Feature Flag Timeline
```
Week 1-2: Development (all flags ON)
Week 3-4: Staging (agent.negotiation ON)
Week 5-6: Prod pilot (1% users, agent.negotiation ON)
Week 7-8: Prod scale (10% → 50% → 100%)
```

### Rollback Plan
If issues detected:
1. Set feature flags to OFF
2. System falls back to existing flows
3. Active sessions are allowed to complete
4. No data loss (all tables are additive)

## Ground Rules Compliance

✅ **pnpm only**: All commands use pnpm
✅ **Additive only**: No existing code deleted
✅ **Feature flags**: All new features default OFF
✅ **Observability**: Structured logging with correlation IDs
✅ **Security**: No secrets in client vars, RLS on all tables
✅ **Migration hygiene**: BEGIN/COMMIT wrappers
✅ **PII masking**: All logging masks sensitive data
✅ **TypeScript strict**: No type errors in new code

## References

- Ground Rules: `docs/GROUND_RULES.md`
- Problem Statement: Issue description
- Migration: `supabase/migrations/20251105131954_agent_orchestration_foundation.sql`
- Orchestrator Code: `services/agent-core/src/modules/orchestrator/`
- Observability: `supabase/functions/_shared/agent-observability.ts`
- Feature Flags: `packages/commons/src/feature-flags.ts`
