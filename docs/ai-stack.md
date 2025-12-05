# easyMO Unified AI Stack

**ADK Go + OpenAI (Realtime/Responses/Agents) + SIP + Google Cloud Speech**

## Architecture

```
                    ┌───────────────────────────────────────────────────────┐
                    │                    TELEPHONY LAYER                     │
                    │  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐ │
                    │  │  SIP Trunk  │  │   WhatsApp  │  │  Voice Notes  │ │
                    │  └──────┬──────┘  └──────┬──────┘  └───────┬───────┘ │
                    └─────────┼────────────────┼─────────────────┼─────────┘
                              │                │                 │
                              ▼                ▼                 ▼
                    ┌───────────────────────────────────────────────────────┐
                    │               VOICE GATEWAY (services/voice-gateway)   │
                    │  • RTP ⟷ WebRTC bridge                                │
                    │  • Call session management                            │
                    │  • OpenAI Realtime integration                        │
                    └───────────────────────┬───────────────────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              │                             │                             │
              ▼                             ▼                             ▼
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│   GOOGLE CLOUD SPEECH   │  │    OPENAI REALTIME      │  │   OPENAI RESPONSES      │
│ (packages/google-speech)│  │    (Live Voice AI)      │  │ (openai-responses-svc)  │
│ • Speech-to-Text        │  │ • Real-time voice       │  │ • Call summarization    │
│ • Text-to-Speech        │  │ • Function calling      │  │ • Entity extraction     │
│ • Translation           │  │ • Turn detection        │  │ • Domain matching       │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
                                                                    │
                                            ┌───────────────────────┴───────────────────────┐
                                            │                                               │
                                            ▼                                               ▼
                               ┌─────────────────────────┐                    ┌─────────────────────────┐
                               │  OPENAI DEEP RESEARCH   │                    │   OPENAI AGENTS SDK     │
                               │ (openai-deep-research)  │                    │    (Python service)     │
                               │ • Autonomous web search │                    │ • Multi-agent workflows │
                               │ • External listings     │                    │ • Complex orchestration │
                               │ • Market intelligence   │                    │ • Handoffs & guardrails │
                               └─────────────────────────┘                    └─────────────────────────┘
                                            │                                               │
                                            └───────────────────────┬───────────────────────┘
                                                                    │
                                                                    ▼
                                            ┌───────────────────────────────────────────────┐
                                            │                  SUPABASE                      │
                                            │  • calls, call_transcripts, call_summaries   │
                                            │  • jobs/farmers/real_estate_call_intakes     │
                                            │  • deep_research_jobs, external_listings     │
                                            │  • sales_leads, sales_claims                 │
                                            └───────────────────────────────────────────────┘
```

---

## Services

| Service | Port | Description |
|---------|------|-------------|
| `voice-gateway` | 3030 | SIP/WebRTC bridge, call sessions, Realtime integration |
| `openai-responses-service` | 3031 | Summarization, intake extraction, matching |
| `openai-deep-research-service` | 3033 | Autonomous web research |

---

## API Reference

### Voice Gateway (`services/voice-gateway`)

```bash
# Start a call
POST /calls/start
{ "from_number": "+250...", "to_number": "+250...", "agent_id": "jobs_ai" }

# Initiate outbound call
POST /calls/outbound
{ "to": "+250...", "agent_id": "sales_sdr_ai", "topic": "campaign_abc" }

# Audio streaming (WebSocket)
ws://host:3030/audio?call_id=<uuid>
```

### Responses Service (`services/openai-responses-service`)

```bash
# Summarize call transcript
POST /summarise-call
{ "call_id": "uuid" }

# Extract domain intake
POST /extract-intake
{ "call_id": "uuid", "domain": "jobs|farmers|real_estate" }

# Find matches
POST /match-domain
{ "call_id": "uuid", "domain": "jobs" }
```

### Deep Research Service (`services/openai-deep-research-service`)

```bash
# Start research
POST /deep-research/start
{ "agent_id": "real_estate_ai", "domain": "real_estate", 
  "query": "Find 2BR apartments in Kigali under 400k RWF" }

# Check status
GET /deep-research/:id/status

# Get results
GET /deep-research/:id/result
```

---

## Environment Variables

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview

# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project
GOOGLE_APPLICATION_CREDENTIALS=/path/to/creds.json

# Services
VOICE_GATEWAY_PORT=3030
RESPONSES_SERVICE_PORT=3031
DEEP_RESEARCH_PORT=3033
```

---

## Packages

| Package | Description |
|---------|-------------|
| `@easymo/google-speech` | STT, TTS, Translation helpers |
| `@easymo/call-capability` | Call session, transcript logger, summarizer |

---

## Database Migrations

| Migration | Tables |
|-----------|--------|
| `20251205100000_call_capability_schema.sql` | calls, call_transcripts, call_summaries |
| `20251205100001_jobs_call_intake.sql` | jobs_call_intakes, jobs_matches |
| `20251205100002_farmers_call_intake.sql` | farmers_call_intakes, farmers_matches |
| `20251205100003_real_estate_call_intake.sql` | real_estate_call_intakes, real_estate_matches |
| `20251205100004_sales_cold_caller.sql` | sales_campaigns, sales_leads, sales_claims |
| `20251205120000_deep_research.sql` | deep_research_jobs, deep_research_results, *_external_listings |
