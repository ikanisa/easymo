# easyMO Services Overview - Fly.io Deployment

**Date:** 2025-12-07  
**Purpose:** Map all easyMO services for Fly.io migration

---

## Overview

easyMO is a multi-service platform running primarily on Supabase Edge Functions with some Node.js
microservices. For Fly.io deployment, we're migrating the following critical services:

---

## 1. Frontend Applications

### 1.1 Admin PWA (`easymo-admin`)

- **Path:** `admin-app/`
- **Tech Stack:** Next.js 15, React 18, TypeScript
- **Current Start:** `next start` (port 3000)
- **Purpose:** Internal staff/admin dashboard for:
  - Managing vendors, users, agents
  - Monitoring system health
  - Configuring AI agents
  - Viewing analytics and reports
- **Auth:** Supabase Auth with `role = 'admin'` enforcement
- **Access:** Internal staff only (no public signup)
- **Fly App Name:** `easymo-admin`
- **Deployment Priority:** HIGH

### 1.2 Vendor Portal PWA (`easymo-vendor`)

- **Path:** Removed (no longer exists)
- **Tech Stack:** Next.js, React, TypeScript
- **Current Start:** `next start`
- **Purpose:** Vendor-only portal for:
  - Managing their business profiles
  - Viewing orders/bookings
  - Updating menu/inventory
  - Responding to customer inquiries
- **Auth:** Supabase Auth with `role = 'vendor'` enforcement
- **Access:** Vendors only (invited/onboarded via Admin Panel, NO public signup)
- **Fly App Name:** `easymo-vendor`
- **Deployment Priority:** HIGH
- **Note:** This is NOT a public consumer app - it's a B2B vendor console

---

## 2. Backend Services

### 2.1 WhatsApp Voice Bridge (`easymo-voice-bridge`)

- **Path:** `services/whatsapp-voice-bridge/`
- **Tech Stack:** Node.js 20, TypeScript, Express, WebRTC (wrtc), ws
- **Current Start:** `node dist/index.js` (port 8080)
- **Purpose:**
  - Bridges WhatsApp voice calls to OpenAI Realtime API
  - Handles WebRTC media streams
  - Manages SIP/voice connections
  - Real-time audio processing
- **Key Dependencies:**
  - `wrtc` - WebRTC implementation
  - `ws` - WebSocket server
  - `@supabase/supabase-js` - Database/auth
  - `pino` - Structured logging
- **Environment Variables:**
  - `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`
  - SIP provider credentials (if applicable)
- **Fly App Name:** `easymo-voice-bridge`
- **Deployment Priority:** CRITICAL
- **Special Requirements:**
  - Needs UDP/WebRTC support
  - Low-latency region (close to Rwanda/SSA)
  - Health check on `/health`

### 2.2 WhatsApp Webhook Router (`easymo-wa-router`)

- **Current Location:** Supabase Edge Functions (`supabase/functions/wa-webhook-core/`)
- **Tech Stack:** Deno (Supabase Edge Function runtime)
- **Migration Path:**
  - **Option A:** Keep on Supabase Edge Functions (recommended)
  - **Option B:** Extract to standalone Node.js service for Fly
- **Purpose:**
  - Receives Meta WhatsApp Cloud API webhooks
  - Routes messages to appropriate AI agents
  - Handles webhook verification
  - Manages message delivery status
- **Key Functions:**
  - `wa-webhook-core` - Main router
  - `wa-webhook-profile` - Profile management
  - `wa-webhook-mobility` - Rides/transport
  - `wa-webhook-property` - Real estate
  - `wa-webhook-jobs` - Job listings
  - `wa-webhook-buy-sell` - Marketplace
  - `wa-webhook-waiter` - Restaurant orders
  - `wa-webhook-insurance` - Insurance quotes
  - `wa-webhook-voice-calls` - Voice call handler
- **Environment Variables:**
  - `WHATSAPP_PHONE_ID` - Meta WhatsApp Phone Number ID
  - `WHATSAPP_ACCESS_TOKEN` - Meta API token
  - `WHATSAPP_VERIFY_TOKEN` - Webhook verification
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Fly App Name:** `easymo-wa-router` (if migrated)
- **Deployment Priority:** CRITICAL
- **Special Requirements:**
  - Must be publicly accessible (Meta webhooks)
  - HTTPS required
  - Fast response time (<5s for webhook verification)
- **Note:** Uses **Meta WhatsApp Cloud API directly**, NOT Twilio

### 2.3 Call Center AGI Backend (`easymo-agents`)

- **Current Location:** Supabase Edge Functions (`supabase/functions/wa-agent-call-center/`)
- **Tech Stack:** Deno/TypeScript (currently), would be Node.js on Fly
- **Migration Path:** Extract to standalone Node.js service
- **Purpose:**
  - Central AI orchestrator (the "brain")
  - Integrates with OpenAI Agents SDK & Realtime API
  - Manages multi-agent workflows
  - Handles voice + text conversations
  - Coordinates domain-specific agents (real estate, mobility, waiter, etc.)
- **Key Components:**
  - `call-center-agi.ts` - Main orchestrator
  - Tool catalog (20+ tools for KB, DB, agents, etc.)
  - Session management
  - Context preservation
- **Environment Variables:**
  - `OPENAI_API_KEY`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`
  - `OPENAI_REALTIME_MODEL` (e.g., `gpt-4-realtime-preview`)
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY` (for dual-provider setup)
- **Fly App Name:** `easymo-agents`
- **Deployment Priority:** CRITICAL
- **Special Requirements:**
  - Persistent WebSocket connections to OpenAI Realtime
  - Low latency
  - High memory (AI processing)

### 2.4 Agent Core Service (`easymo-agent-core`)

- **Path:** `services/agent-core/`
- **Tech Stack:** NestJS, TypeScript, Prisma
- **Current Start:** `npm run start:prod`
- **Purpose:**
  - Database-driven agent configuration
  - Agent lifecycle management
  - Metrics and monitoring
- **Environment Variables:**
  - `DATABASE_URL` (separate from Supabase, Prisma-managed)
  - `REDIS_URL`, `KAFKA_BROKERS`
- **Fly App Name:** `easymo-agent-core`
- **Deployment Priority:** MEDIUM

### 2.5 SMS Inbound Webhook (`easymo-sms-webhook`)

- **Current Location:** `supabase/functions/sms-inbound-webhook/`
- **Tech Stack:** Deno (Supabase Edge Function)
- **Migration Path:** Could stay on Supabase or extract to Fly
- **Purpose:**
  - Receives SMS from MTN Rwanda gateway
  - Routes to Call Center AGI
  - Enables omnichannel (voice + WhatsApp + SMS)
- **Environment Variables:**
  - `MTN_SMS_API_KEY`, `MTN_SMS_API_SECRET`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Fly App Name:** `easymo-sms-webhook` (if migrated)
- **Deployment Priority:** MEDIUM

### 2.6 Post-Call Notify Service (`easymo-post-call`)

- **Current Location:** `supabase/functions/post-call-notify/`
- **Tech Stack:** Deno (Supabase Edge Function)
- **Migration Path:** Could stay on Supabase or extract to Fly
- **Purpose:**
  - Sends call summaries after voice calls
  - Dual-channel delivery (WhatsApp + SMS)
- **Fly App Name:** `easymo-post-call` (if migrated)
- **Deployment Priority:** LOW (can stay on Supabase)

---

## 3. Background Workers / Cron Jobs

### 3.1 WhatsApp Webhook Worker (`easymo-wa-worker`)

- **Path:** `services/whatsapp-webhook-worker/`
- **Tech Stack:** Node.js, TypeScript, Bull/Redis
- **Purpose:**
  - Async processing of WhatsApp messages
  - Queue management
  - Retry logic for failed deliveries
- **Fly App Name:** `easymo-wa-worker`
- **Deployment Priority:** MEDIUM

### 3.2 Mobility Orchestrator (`easymo-mobility`)

- **Path:** `services/mobility-orchestrator/`
- **Tech Stack:** Node.js, TypeScript
- **Purpose:**
  - Rides matching
  - Driver coordination
  - Real-time location updates
- **Fly App Name:** `easymo-mobility`
- **Deployment Priority:** MEDIUM

---

## 4. Services NOT Migrating to Fly

These will remain on their current platforms:

### 4.1 Supabase Services (Stay on Supabase)

- **Database & Auth:** PostgreSQL, Auth
- **Storage:** File uploads, images
- **Edge Functions:** Most domain-specific webhooks can stay
- **Real-time:** Subscriptions

### 4.2 Other Microservices (Evaluate Later)

- `video-orchestrator` - May not be production-critical yet
- `openai-deep-research-service` - Low usage
- `openai-responses-service` - Low usage
- `wallet-service` - NestJS service, evaluate based on usage
- `vendor-service`, `buyer-service` - May consolidate

---

## 5. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       FLY.IO CLUSTER                         │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  easymo-admin   │  │ easymo-vendor   │  (Frontends)     │
│  │  Next.js PWA    │  │  Next.js PWA    │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ easymo-voice-   │  │  easymo-wa-     │  (Core Services) │
│  │     bridge      │  │    router       │                  │
│  │ WebRTC/Voice    │  │ Meta WhatsApp   │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  easymo-agents  │  │ easymo-agent-   │  (AI/Agents)     │
│  │  Call Center    │  │     core        │                  │
│  │      AGI        │  │   NestJS        │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ easymo-wa-      │  │ easymo-mobility │  (Workers)       │
│  │    worker       │  │  Orchestrator   │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE CLOUD                            │
│  - PostgreSQL Database                                       │
│  - Auth & User Management                                    │
│  - Storage (images, files)                                   │
│  - Remaining Edge Functions                                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  - Meta WhatsApp Cloud API                                   │
│  - OpenAI API (Realtime, Agents, Responses)                  │
│  - MTN Rwanda SMS Gateway                                    │
│  - Google Maps API                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Deployment Priority Matrix

| Service               | Priority | Complexity | Dependencies            | Region |
| --------------------- | -------- | ---------- | ----------------------- | ------ |
| `easymo-admin`        | HIGH     | Low        | Supabase                | ams    |
| `easymo-vendor`       | HIGH     | Low        | Supabase                | ams    |
| `easymo-voice-bridge` | CRITICAL | High       | OpenAI, Supabase        | ams    |
| `easymo-wa-router`    | CRITICAL | Medium     | Meta WhatsApp, Supabase | ams    |
| `easymo-agents`       | CRITICAL | High       | OpenAI, Supabase        | ams    |
| `easymo-agent-core`   | MEDIUM   | Medium     | Postgres, Redis         | ams    |
| `easymo-wa-worker`    | MEDIUM   | Medium     | Redis, Kafka            | ams    |
| `easymo-mobility`     | MEDIUM   | Medium     | Supabase                | ams    |
| `easymo-sms-webhook`  | LOW      | Low        | MTN, Supabase           | ams    |

**Recommended Region:** `ams` (Amsterdam) - Good latency to Rwanda/SSA, well-supported Fly region

---

## 7. Critical Notes

### WhatsApp Integration

- **IMPORTANT:** easyMO uses **Meta WhatsApp Cloud API directly**
- **NO Twilio** - Do not introduce or reference Twilio anywhere
- Webhook URL must be publicly accessible with HTTPS
- Webhook verification token required
- Message delivery status webhooks required

### Voice Bridge Requirements

- Needs WebRTC/UDP support
- Low-latency critical (voice quality)
- Persistent WebSocket connections
- Health check endpoint required

### Auth & Access Control

- **Admin PWA:** Staff-only, role enforcement
- **Vendor Portal:** Vendors-only, no public signup, role enforcement
- Both use Supabase Auth
- All routes protected behind login

### Environment Management

- All secrets via `fly secrets set`
- No `.env` files in containers
- 12-factor app principles
- Separate configs per environment (staging/production)

---

## 8. Next Steps

1. **Phase 1:** Containerize services (Dockerfiles)
2. **Phase 2:** Generate `fly.toml` configs
3. **Phase 3:** Set up environment variables
4. **Phase 4:** Deploy staging instances
5. **Phase 5:** Test end-to-end flows
6. **Phase 6:** Set up CI/CD
7. **Phase 7:** Production cutover

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-07  
**Next Review:** After Phase 1 completion
