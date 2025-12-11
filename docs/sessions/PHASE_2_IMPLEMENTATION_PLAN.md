# Phase 2: Agent Code Implementation

**Date:** 2025-12-09 14:10 UTC  
**Status:** 🟡 IN PROGRESS  
**Prerequisites:** ✅ Phase 1 migrations deployed successfully

---

## 🎯 Phase 2 Goals

1. **Waiter Agent Discovery Flow** - Enable bar/restaurant discovery without QR code
2. **QR Code Deep Link Handler** - Parse QR codes and initialize sessions
3. **Business Broker Agent Enhancement** - Add AI-powered search
4. **Integration Testing** - End-to-end validation

---

## 📋 Task Breakdown

### Task 2.1: Update Waiter Agent Session Manager ✅ Starting

**File:** `supabase/functions/wa-agent-waiter/core/session-manager.ts` **Changes:**

- Use new `ai_agent_sessions` table
- Update context structure to include `barId`, `restaurantId`, `tableNumber`, `discoveryState`

### Task 2.2: Add Waiter Agent Discovery Flow

**File:** `supabase/functions/wa-agent-waiter/core/waiter-agent.ts` **Changes:**

- Add discovery state machine
- Handle "no context" scenario
- Query `bars` table for nearby bars
- Format results with emoji numbers

### Task 2.3: Create Bar Search Functions

**File:** `supabase/functions/wa-agent-waiter/core/bar-search.ts` (NEW) **Purpose:**

- Search nearby bars by location
- Search bars by name
- Get bar details

### Task 2.4: Create QR Code Handler

**File:** `supabase/functions/wa-webhook/router/qr-handler.ts` (NEW) **Purpose:**

- Parse QR format: `easymo://waiter?bar_id=xxx&table=5`
- Create session with full context
- Route to Waiter Agent

### Task 2.5: Update Business Broker Agent

**File:** `packages/agents/src/agents/general/business-broker.agent.ts` **Changes:**

- Use `search_businesses_ai()` function
- Add natural language intent classification
- Format results with emoji numbers

### Task 2.6: Integration Testing

**Purpose:**

- Test Waiter discovery flow
- Test QR code scanning
- Test Business search
- End-to-end validation

---

## 🚀 Starting with Task 2.1...
