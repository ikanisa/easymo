# WhatsApp Pipeline Architecture

**Version:** 3.0.0  
**Last Updated:** 2025-11-22  
**Status:** Production-ready

## Overview

The WhatsApp pipeline is the **single unified entry point** for all user interactions with EasyMO
agents. It handles message normalization, routing, intent parsing, and response delivery.

**Design Principle:** One webhook to rule them all - no more per-feature handlers.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    WhatsApp Business API                         │
│                  (Cloud API Webhook Events)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ POST /wa-webhook-core
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Core Webhook Handler                          │
│             supabase/functions/wa-webhook-core/                  │
│                                                                   │
│  1. Verify signature (security)                                  │
│  2. Extract message data                                         │
│  3. Generate correlation ID                                      │
│  4. Route to domain-specific handler                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Message Normalization                         │
│                                                                   │
│  INSERT whatsapp_users → whatsapp_conversations → whatsapp_messages
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Domain Routing                              │
│               (Router.routeMessage)                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Intent Parsing                              │
│                    (LLM API Call)                                │
│                                                                   │
│  INSERT ai_agent_intents (status: "pending")                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Apply Intent                                │
│              (Database Function - Agent-Specific)                │
│                                                                   │
│  apply_intent_{agent_name}() → UPDATE domain tables             │
│                              → CREATE matches                     │
│                              → SET status = 'applied'             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Response Generation                           │
│                  (Agent Format + Send)                           │
│                                                                   │
│  - Short message (1-2 sentences)                                 │
│  - Emoji-numbered options (1️⃣ 2️⃣ 3️⃣)                           │
│  - Send via WhatsApp Business API                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Webhook Handler

**File:** `supabase/functions/wa-webhook-core/index.ts`

**Responsibilities:**

- Verify WhatsApp webhook signature
- Extract message data from payload
- Generate correlation ID for tracing
- Handle health checks
- Error handling & logging

### 2. Router

**File:** `supabase/functions/wa-webhook-core/router.ts`

**Responsibilities:**

- Route messages to domain-specific handlers
- Load agent configuration
- Invoke LLM for intent parsing
- Call apply_intent functions
- Format and send responses

### 3. Database Tables

#### whatsapp_users

Normalized WhatsApp user registry

#### whatsapp_conversations

Active conversation contexts per user

#### whatsapp_messages

Message history with correlation IDs

#### ai_agent_intents

Parsed user intentions with extracted parameters

#### ai_agent_match_events

Match/notification triggers

---

## Message Flow Example: Job Search

**User:** "I'm looking for driver jobs in Kigali"

1. **Webhook receives** WhatsApp payload
2. **Normalize** → Insert into whatsapp\_\* tables
3. **Route** → Determine active agent (Jobs)
4. **Parse** → LLM extracts `{ intent_type: "search_jobs", role: "driver", location: "Kigali" }`
5. **Apply** → Query job_listings, return results
6. **Respond** → "Found 5 driver jobs: 1️⃣ Delivery Driver..."

---

## Security

- Webhook signature verification
- Rate limiting (max 10 msgs/min)
- Input sanitization
- PII masking in logs

---

## Performance

- Agent config caching (1 hour TTL)
- Batch intent processing
- Database indexes on hot paths

---

## Monitoring

**Key Metrics:**

- Requests/min per agent
- Latency (parsing, DB, total)
- Error rate per intent type
- Message delivery success rate

---

## Deployment

```bash
# Staging
supabase functions deploy wa-webhook-ai-agents --project-ref staging

# Production
supabase functions deploy wa-webhook-ai-agents --project-ref prod
```

---

## Troubleshooting

**Slow responses?** Check LLM latency, add DB indexes  
**Wrong agent?** Reset conversation: `UPDATE whatsapp_conversations SET active_agent_id = NULL`  
**Messages not processing?** Check function logs, verify webhook signature

---

**See also:** `agents-map.md` for agent details, `profile-and-wallet.md` for workflows

**Maintainer:** Platform Team  
**Last Updated:** 2025-11-22
