---
description: Cold Caller / Sales AI Refactor - Implement outbound call campaigns with structured claim handling
---

# easyMO – Cold Caller / Sales AI Refactor

You are Copilot CLI (or Gemini CLI) inside the easyMO repo.

## Goal
- Analyze the current "cold caller" / sales AI implementation
- Refactor using patterns from `microsoft/call-center-ai`:
  - Outbound call API
  - Structured claim schema per campaign
  - Robust call logging and dispositions
  - Support for future human hand-off

## Context
- Reference: `microsoft/call-center-ai` on GitHub
  - Exposes `POST /call` for outbound calls with `claim` schema
  - Stores conversations with structured claims
- We have shared "Call Capability" using ADK and Supabase
- Sales agent at: `packages/agents/src/agents/sales/`

## Tasks

### 1. Locate Cold Caller Code

Find all code related to:
- Outbound calls, sales campaigns
- Lead tables in Supabase
- WhatsApp/phone sales endpoints

### 2. Campaign Config Model

Create/update config structure:
```typescript
interface CampaignConfig {
  id: string;
  name: string;
  segment: 'pharmacies' | 'bars' | 'moto_drivers' | string;
  script_goal: string;
  claim_schema: ClaimField[];
  max_attempts: number;
  call_window: { start: string; end: string };
  cooldown_minutes: number;
}

interface ClaimField {
  name: string;
  type: 'text' | 'integer' | 'boolean' | 'date' | 'enum';
  required?: boolean;
  enum_values?: string[];
}
```

### 3. Outbound Call API

Implement `POST /call` endpoint:
```typescript
// Request
{
  campaign_id: string;
  lead_id?: string;
  phone_number?: string;
  language?: string;
}

// Creates calls row, triggers outbound via voice gateway
// Connects to cold caller ADK agent with campaign context
```

### 4. In-Call Behavior

Cold caller agent should:
- Load campaign's `claim_schema`
- Ask questions conversationally to fill claim fields
- Update `call_transcripts` during call
- At call end:
  - Write to `call_summaries`
  - Store claims in `sales_claims` (key/value pairs)
  - Set `disposition` in `sales_call_interactions`

### 5. Dispositions & Follow-Up

Handle outcomes:
- `INTERESTED` → Create follow-up tasks
- `CALL_BACK` → Schedule retry call
- `DO_NOT_CALL` → Mark lead opted-out
- `NO_ANSWER` → Retry based on max_attempts

### 6. Database Tables

Create/update:
```sql
-- call_disposition enum
CREATE TYPE call_disposition AS ENUM (
  'INTERESTED', 'NOT_INTERESTED', 'CALL_BACK', 'NO_ANSWER', 'DO_NOT_CALL'
);

-- sales_leads
CREATE TABLE sales_leads (
  id UUID PRIMARY KEY,
  segment TEXT,
  name TEXT,
  phone_number TEXT,
  category TEXT,
  location_district TEXT,
  tags TEXT[],
  opted_out BOOLEAN DEFAULT FALSE
);

-- sales_call_interactions
CREATE TABLE sales_call_interactions (
  id UUID PRIMARY KEY,
  call_id UUID REFERENCES calls(id),
  lead_id UUID REFERENCES sales_leads(id),
  campaign_id UUID,
  disposition call_disposition,
  follow_up_at TIMESTAMPTZ,
  notes TEXT
);

-- sales_claims
CREATE TABLE sales_claims (
  id BIGSERIAL PRIMARY KEY,
  call_id UUID REFERENCES calls(id),
  key TEXT NOT NULL,
  value TEXT,
  value_type TEXT
);
```

## What to Deliver

1. Updated `packages/agents/src/agents/sales/` with campaign awareness
2. New cold-caller module in `services/agent-core/src/modules/cold-caller/`
3. SQL migrations for sales tables
4. Documentation for:
   - Defining new campaigns
   - Triggering campaign calls
   - Interpreting stored call data
