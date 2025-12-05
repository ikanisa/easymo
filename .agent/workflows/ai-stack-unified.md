---
description: Master prompt for implementing the unified AI stack with ADK Go, OpenAI APIs, SIP telephony, and Google Cloud speech
---

# easyMO – Full AI Stack Implementation (ADK Go + OpenAI + SIP + Google Cloud speech)

You are GitHub Copilot CLI or Gemini CLI working inside the easyMO monorepo.

## Goal

Build a production-ready AI stack that unifies:

- Google Agent Development Kit for Go (ADK Go) as our orchestration and domain layer.
- OpenAI Responses API as the main text + tools + stateful interface.
- OpenAI Realtime API for ultra-low-latency voice interactions.
- OpenAI Agents SDK (Python) for multi-agent workflows.
- SIP trunk telephony and a Voice Gateway for calls.
- Google Cloud Speech-to-Text, Text-to-Speech, and Translation APIs for robust telephony speech and multilingual support.
- Supabase as the central database for calls, transcripts, summaries, and domain data.

## Constraints

- No references to Twilio anywhere. Use generic SIP trunk + SBC language.
- The WhatsApp channel uses the Meta WhatsApp API directly (already in the repo).
- All changes must be additive and safe; no destructive refactors without clear migrations.

## High-level Architecture

1. **Telephony**:
   - SIP trunk -> Session Border Controller (SBC) -> Voice Gateway service (our code).
   - Voice Gateway bridges RTP audio <-> WebRTC/WebSockets/HTTP to Realtime / STT services.

2. **Media & language services (Google Cloud)**:
   - Cloud Speech-to-Text for phone-grade transcription.
   - Cloud Text-to-Speech for generating audio prompts back to callers.
   - Cloud Translation API for translating transcripts and responses between languages.

3. **OpenAI layer**:
   - Realtime API for streaming voice conversations (browser WebRTC and Voice Gateway).
   - Responses API for all text interactions, call summarization, entity extraction, and matching.
   - Agents SDK (Python) for multi-agent workflows and long-running tasks (jobs, real estate, farmer marketplace, sales campaigns).

4. **Orchestration**:
   - ADK Go agents per domain (jobs, farmers, real estate, waiter, sales SDR, etc.).
   - ADK tools wrap:
     - Supabase domain queries and writes.
     - HTTP calls to OpenAI Responses microservice.
     - HTTP calls to OpenAI Agents SDK microservice.
     - HTTP calls to Voice Gateway (if needed for prompts).
     - HTTP calls to Google Cloud STT/TTS/Translate functions.

5. **Data & memory**:
   - Supabase tables:
     - calls, call_transcripts, call_summaries
     - jobs_call_intakes, jobs_matches
     - farmers_call_intakes, farmers_matches
     - real_estate_call_intakes, real_estate_matches
     - sales_leads, sales_call_interactions, sales_claims
     - deep_research_jobs, deep_research_results
   - Existing business domain tables (menus, properties, jobs, users, etc.) remain the source of truth.

---

## TASK 1 – Repo Discovery and Planning

1. Scan the repo to identify:
   - Existing ADK Go usage (imports from `google.golang.org/adk` and related packages).
   - Existing OpenAI API usage (chat/completions, audio, etc.).
   - Existing WhatsApp webhook handlers and Supabase DB access helpers.
   - Any existing telephony or SIP-related code.
   - Any domain agents for: Jobs & Gigs, Farmers / Produce, Real Estate, Waiter / Restaurants, Sales / Cold caller AI

2. Produce a short summary of:
   - Where ADK agents are defined.
   - Where OpenAI is called.
   - Where Supabase DB helpers live.
   - Where WhatsApp flows are implemented.

---

## TASK 2 – Supabase Schema Alignment

Create migrations for:

- Enum: `call_channel` ('phone', 'whatsapp_call', 'whatsapp_voice_note')
- Table: `calls` with user_id, agent_id, channel, direction, status, metadata
- Table: `call_transcripts` with call_id, seq, role, text, raw
- Table: `call_summaries` with summary, language, main_intent, sentiment, entities, next_actions
- Tables: `jobs_call_intakes`, `farmers_call_intakes`, `real_estate_call_intakes`
- Tables: `sales_leads`, `sales_call_interactions`, `sales_claims`
- Enum: `deep_research_status`
- Tables: `deep_research_jobs`, `deep_research_results`

---

## TASK 3 – Voice Gateway & SIP Integration

Create `services/voice-gateway/` with:

1. HTTP/gRPC server exposing:
   - `/calls/start` – start a call session
   - `/calls/audio` – streaming endpoint (WebSocket or gRPC bidirectional)
   - Returns synthesized audio frames using Text-to-Speech

2. Telephony interface:
   - Map provider_call_id and phone number to a new `calls` row.
   - Handle call events: ringing, answered, hangup.
   - Generic SIP trunk + SBC integration.

---

## TASK 4 – Google Cloud STT, TTS, and Translate Helpers

Create `packages/google-speech/` with:

1. `transcribe_stream(audio_stream, language_code) -> async text chunks`
2. `synthesize_speech(text, voice_params) -> audio_stream`
3. `translate_text(text, source_lang, target_lang) -> text`

---

## TASK 5 – OpenAI Realtime Integration

Enhance `packages/ai/src/agents/openai/realtime-client.ts`:

1. Add function calling support
2. Connect to ADK tools for Supabase writes
3. Session management with call_id linking
4. Voice Gateway ↔ Realtime bridge

---

## TASK 6 – OpenAI Responses Microservice

Create `services/openai-responses-service/`:

1. `POST /summarise-call`:
   - Input: call_id, transcript
   - Uses Responses API with structured output
   - Writes to call_summaries and domain intake tables

2. `POST /match-domain`:
   - Input: domain, call_id or entities
   - Uses function-calling tools for Supabase SQL/RPC
   - Writes to *_matches tables

---

## TASK 7 – OpenAI Agents SDK Microservice

Create `agents/openai-agents-service/` (Python):

1. Install `openai-agents` with voice extras
2. Implement multi-agent workflows:
   - Jobs (triage → jobseeker agent → employer agent → matching agent)
   - Real estate (need collector → researcher → negotiator)
   - Farmers & buyers (producer agent → buyer agent → pricing agent)
   - Sales SDR campaigns (campaign agent → cold caller → follow-up agent)

3. Expose HTTP endpoints:
   - `POST /agents/jobs-flow`
   - `POST /agents/real-estate-flow`
   - `POST /agents/farmers-flow`
   - `POST /agents/sales-campaign-run`

---

## TASK 8 – ADK Go Domain Agents and Tools

Create `/adk/` with packages:
- `/adk/jobs`
- `/adk/farmers`
- `/adk/realestate`
- `/adk/waiter`
- `/adk/sales_sdr`

Each package has:
- ADK agent with instructions
- Tools: log_call_*, summarise_call, upsert_intake, run_matching, translate_text, stt, tts

Wire ADK agents into WhatsApp webhooks and Voice Gateway.

---

## TASK 9 – Cold Caller / Sales SDR Using This Stack

Refactor cold caller to:

1. Use shared `calls`, `call_transcripts`, `call_summaries`, and `sales_*` tables
2. Use OpenAI Agents SDK for campaign orchestration
3. Use Realtime API + Voice Gateway for live calls
4. Use Responses API for summarization and claim extraction

---

## TASK 10 – Docs & Configuration

1. Create `docs/ai-stack.md` with architecture diagram and setup instructions
2. Add `.env.example` files for all services
3. Document Google Cloud, OpenAI, and Supabase configuration

---

## TASK 11 – OpenAI Deep Research Integration

Create `services/openai-deep-research-service/`:

1. `POST /deep-research/start` - Start research job, write to deep_research_jobs
2. `GET /deep-research/:id/status` - Poll job status
3. `GET /deep-research/:id/result` - Get final report

Background worker polls OpenAI Deep Research API and updates results.

ADK Go tools:
- `start_deep_research(domain, query, context) -> job_id`
- `get_deep_research_result(job_id) -> summary, citations, raw_report`

Wire into domain agents for external research when internal matching is weak.
