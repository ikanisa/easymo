---
description: ADK Go & Call Capability Refactor - Comprehensive prompt for implementing unified call handling across all agents
---

# easyMO – ADK Go & Call Capability Refactor

You are GitHub Copilot CLI (or Gemini CLI) working inside the easyMO monorepo.

## Goal
- Analyze all usages of the Google Agent Development Kit for Go (`google.golang.org/adk`) in this repo
- Standardize agents around a shared "Call Capability" pattern
- Implement Supabase-backed call logging, transcripts, and summaries across all agents

## Context
- We use Google ADK Go as the agent framework. Key files:
  - `packages/ai/src/agents/google/adk-client.ts` - ADK client wrapper
  - `packages/ai/src/core/unified-gateway.ts` - Multi-provider gateway
  - `services/voice-bridge/` - Voice call handling service
  - `services/agent-core/` - NestJS agent orchestration
- We want to borrow patterns from `microsoft/call-center-ai` for structured "claim" fields
- Telephony may be phone calls or WhatsApp calls/voice notes

## What to Analyze

1. Find all files that:
   - Import from `@easymo/ai` or `packages/ai`
   - Implement domain agents (farmer, jobs, property, sales, waiter)
   - Handle voice/call endpoints

2. For each agent, identify:
   - Where the agent is instantiated (tools array, instructions)
   - How it connects to WhatsApp/phone/HTTP endpoints
   - Whether it uses sessions + memory
   - Any existing notion of "call" or "voice"

## Design to Implement

### 1. Shared Call Capability Package (`packages/call-capability`)

Create package with:
- `src/call-session.ts` - Create/end calls, track duration
- `src/transcript-logger.ts` - Append chunks to `call_transcripts`
- `src/summarizer.ts` - Trigger summarizer, write to `call_summaries`
- `src/tools/` - ADK tools (save_call_event, append_transcript, save_summary)

### 2. Supabase Schema

Create migrations for:
```sql
-- call_channel enum ('phone', 'whatsapp_call', 'whatsapp_voice_note')
-- calls (user_id, agent_id, channel, direction, status, metadata)
-- call_transcripts (call_id, seq, role, text, timestamps)
-- call_summaries (call_id, summary, entities, next_actions)
-- Domain intakes: jobs_call_intakes, farmers_call_intakes, real_estate_call_intakes
-- Matching tables: jobs_matches, farmers_matches, real_estate_matches
```

### 3. Domain Agent Tools

For each agent, add ADK tools:
- `upsert_{domain}_call_intake` - Save structured intake from call
- Integration with `call-capability` module for logging

### 4. Matching Logic

Implement domain-specific matchers:
- Jobs: jobseekers ↔ job postings
- Farmers: produce offers ↔ buyer demands
- Real Estate: seekers ↔ property listings

## What to Deliver

1. Summary of all current ADK usages and refactoring needed
2. New `packages/call-capability` with tools and helpers
3. Supabase migration files
4. Updated agent files with call-aware tools
5. Documentation explaining the Call Capability pattern
