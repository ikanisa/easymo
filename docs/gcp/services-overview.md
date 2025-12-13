# easyMO Services Overview – Google Cloud Run Deployment

## Project Information

- **GCP Project**: easymoai
- **Billing Account**: 01D051-E1A6B9-CC9562
- **Organization**: ikanisa.com
- **Default Region**: europe-west1

---

## Core Services for Cloud Run

### 1. Admin PWA (Internal Staff Dashboard)

- **Name**: `easymo-admin`
- **Path**: `/admin-app`
- **Type**: `internal_admin`
- **Tech Stack**: Next.js 15, React 18, TypeScript 5.5
- **Dev Command**: `npm run dev` (port 3000)
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Dockerfile**: `/admin-app/Dockerfile` ✅ (exists)
- **Auth Required**: Yes - IAP + Supabase admin role
- **Notes**:
  - Internal staff only (ops, support, management)
  - Multi-stage Next.js build
  - Standalone output enabled

### 2. Vendor Portal PWA (Onboarded Vendors)

- **Name**: `easymo-vendor`
- **Path**: `/waiter-pwa`
- **Type**: `internal_vendor`
- **Tech Stack**: Next.js 15, React 18, TypeScript 5.5
- **Dev Command**: `pnpm dev` (port 3001)
- **Build Command**: `pnpm build`
- **Start Command**: `pnpm start`
- **Dockerfile**: ⚠️ Needs creation (similar to admin-app)
- **Auth Required**: Yes - IAP + Supabase vendor role
- **Notes**:
  - For onboarded vendors (bars, restaurants)
  - Previously called "waiter-pwa"
  - NO public signup - vendors created via Admin

### 3. Client PWA (End Users - Public)

- **Name**: `easymo-client`
- **Path**: `/client-pwa`
- **Type**: `public_app`
- **Tech Stack**: Next.js 15, React 19, TypeScript 5.7
- **Dev Command**: `pnpm dev` (port 3002)
- **Build Command**: `pnpm build`
- **Start Command**: `pnpm start`
- **Dockerfile**: ⚠️ Needs creation
- **Auth Required**: No IAP (public), optional Supabase auth for features
- **Notes**:
  - Public-facing consumer app
  - Mobility, marketplace features

### 4. Voice Bridge (SIP ↔ WhatsApp ↔ OpenAI Realtime)

- **Name**: `easymo-voice-bridge`
- **Path**: `/services/voice-bridge`
- **Type**: `voice_service`
- **Tech Stack**: Node.js 20, Express, WebSocket, TypeScript
- **Dev Command**: `pnpm start:dev`
- **Build Command**: `pnpm build`
- **Start Command**: `pnpm start` (runs dist/server.js)
- **Dockerfile**: `/services/voice-bridge/Dockerfile` ✅ (exists)
- **Auth Required**: No IAP (webhook endpoint), signature verification
- **Notes**:
  - Handles SIP/phone + WhatsApp voice
  - Connects to OpenAI Realtime API
  - WebSocket server for real-time audio

### 5. WhatsApp Webhook Router (Meta API)

- **Name**: `easymo-wa-router`
- **Path**: `/services/whatsapp-webhook-worker`
- **Type**: `public_api`
- **Tech Stack**: Node.js 20, Express, TypeScript
- **Dev Command**: `pnpm start:dev`
- **Build Command**: `pnpm build`
- **Start Command**: `pnpm start` (port 4900)
- **Dockerfile**: `/services/whatsapp-webhook-worker/Dockerfile` ✅ (exists)
- **Auth Required**: No IAP (Meta webhook), Meta signature verification
- **Notes**:
  - Main entry point for all WhatsApp messages
  - Routes to appropriate Edge Functions
  - Uses Meta WhatsApp Cloud API only (NO Twilio)

### 6. Agent Core / Call Center Backend

- **Name**: `easymo-agent-core`
- **Path**: `/services/agent-core`
- **Type**: `public_api`
- **Tech Stack**: NestJS 10, Prisma, OpenAI SDK, TypeScript
- **Dev Command**: `pnpm start:dev`
- **Build Command**: `pnpm build` (prebuild: builds @easymo/db)
- **Start Command**: `pnpm start` (runs dist/main.js)
- **Dockerfile**: ⚠️ Needs creation
- **Auth Required**: API keys / service tokens
- **Notes**:
  - Multi-agent orchestration (OpenAI Agents, Realtime)
  - Prisma for Agent-Core DB (separate from Supabase)
  - OpenTelemetry instrumentation

---

## Supporting Microservices (Phase 2)

### 7. Voice Media Server

- **Name**: `easymo-voice-media`
- **Path**: `/services/voice-media-server`
- **Type**: `voice_service`
- **Dockerfile**: ✅ Exists

### 8. Voice Media Bridge

- **Name**: `easymo-voice-media-bridge`
- **Path**: `/services/voice-media-bridge`
- **Type**: `voice_service`
- **Dockerfile**: ✅ Exists

### 9. WhatsApp Voice Bridge

- **Name**: `easymo-whatsapp-voice`
- **Path**: `/services/whatsapp-voice-bridge`
- **Type**: `voice_service`
- **Dockerfile**: ✅ Exists

### 10. Mobility Orchestrator

- **Name**: `easymo-mobility`
- **Path**: `/services/mobility-orchestrator`
- **Type**: `public_api`
- **Dockerfile**: ✅ Exists

### 11. Ranking Service

- **Name**: `easymo-ranking`
- **Path**: `/services/ranking-service`
- **Type**: `worker`
- **Dockerfile**: ✅ Exists

### 12. Wallet Service

- **Name**: `easymo-wallet`
- **Path**: `/services/wallet-service`
- **Type**: `worker`
- **Dockerfile**: ✅ Exists

### 13. Buyer/Profile Services

- **Paths**: `/services/{buyer-service,profile}`
- **Type**: `public_api`
- **Dockerfiles**: ✅ Exist

---

## Background Workers / Cron Jobs

These can run as **Cloud Run Jobs** or scheduled Cloud Run services:

1. **cleanup-expired** (Supabase Edge Function) - Can migrate to Cloud Run Job
2. **data-retention** (Supabase Edge Function) - Can migrate to Cloud Run Job
3. **recurring-trips-scheduler** (Supabase Edge Function)
4. **insurance-renewal-reminder** (Supabase Edge Function)
5. **notification-worker** (Supabase Edge Function)

For now, these remain as Supabase Edge Functions. Migration to Cloud Run Jobs is Phase 3.

---

## Supabase Edge Functions (Remain on Supabase)

These stay on Supabase (Deno runtime):

- All `wa-webhook-*` functions (wa-webhook-core, wa-webhook-mobility, etc.)
- `wa-agent-*` functions (AI conversation handlers)
- `openai-realtime-sip`, `sip-voice-webhook`
- Admin functions: `admin-stats`, `admin-messages`, etc.
- OCR processors, lookup functions

**Why?** Tight integration with Supabase DB, auth, storage. No benefit from Cloud Run migration.

---

## Deployment Priority (Phased Approach)

### Phase 1 (Week 1) - Core Services

1. ✅ Admin PWA (`easymo-admin`)
2. Vendor Portal PWA (`easymo-vendor`)
3. WhatsApp Router (`easymo-wa-router`)
4. Agent Core (`easymo-agent-core`)

### Phase 2 (Week 2) - Voice & Mobility

5. Voice Bridge (`easymo-voice-bridge`)
6. Voice Media services (3 services)
7. Mobility Orchestrator
8. Client PWA (`easymo-client`)

### Phase 3 (Week 3+) - Supporting Services

9. Wallet, Ranking, Video services
10. Background workers → Cloud Run Jobs
11. Monitoring & optimization

---

## Service Dependencies

```
┌─────────────────┐
│   Admin PWA     │──┐
│  (internal)     │  │
└─────────────────┘  │
                      │
┌─────────────────┐  │     ┌─────────────────┐
│  Vendor Portal  │──┼────▶│   Supabase DB   │
│  (internal)     │  │     │   + Auth + RLS  │
└─────────────────┘  │     └─────────────────┘
                      │              ▲
┌─────────────────┐  │              │
│   Client PWA    │──┘              │
│   (public)      │                 │
└─────────────────┘                 │
                                     │
┌─────────────────┐     ┌─────────────────┐
│ WhatsApp Router │────▶│ Supabase Edge   │
│  (Meta API)     │     │   Functions     │
└─────────────────┘     └─────────────────┘
         │                       ▲
         │                       │
         ▼                       │
┌─────────────────┐              │
│  Agent Core     │──────────────┘
│  (NestJS)       │
└─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Voice Bridge   │────▶│ OpenAI Realtime │
│  (WebSocket)    │     │      API        │
└─────────────────┘     └─────────────────┘
```

---

## Next Steps

1. ✅ Review services overview
2. Create Dockerfiles for missing services (Vendor Portal, Client PWA, Agent Core)
3. Set up Artifact Registry
4. Define environment variables per service
5. Create IAP config for Admin + Vendor Portal
6. Build CI/CD with GitHub Actions

See:

- [docker-notes.md](./docker-notes.md) - Dockerfile details
- [artifact-registry.md](./artifact-registry.md) - Container registry setup
- [cloud-run-services.md](./cloud-run-services.md) - Deployment commands
- [env-vars.md](./env-vars.md) - Environment configuration
- [iap-admin-vendor.md](./iap-admin-vendor.md) - IAP setup
- [ci-cd.md](./ci-cd.md) - GitHub Actions pipeline
