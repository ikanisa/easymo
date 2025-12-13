# EasyMO Architecture Documentation

**Version**: 2.0  
**Last Updated**: 2025-11-27  
**Status**: Post-Refactoring Architecture

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Layers](#architecture-layers)
4. [Service Architecture](#service-architecture)
5. [Data Flow](#data-flow)
6. [Package Structure](#package-structure)
7. [Deployment Topology](#deployment-topology)

---

## System Overview

EasyMO is a WhatsApp-first mobility and marketplace platform built as a TypeScript monorepo using
pnpm workspaces. The system integrates AI agents, real-time messaging, payment processing, and
marketplace features.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  WhatsApp    │  │  Admin App   │  │  PWAs        │      │
│  │  (Meta API)  │  │  (Next.js)   │  │  (React)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Edge Functions Layer                      │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Supabase Edge Functions (Deno)                    │     │
│  │  • wa-webhook-core (routing)                       │     │
│  │  • wa-webhook-ai-agents                           │     │
│  │  • wa-webhook-mobility, wallet, jobs, property    │     │
│  │  • admin-* (settings, stats, users, trips)        │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Microservices Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ agent-core   │  │ wallet-      │  │ profile      │      │
│  │ (NestJS)     │  │ service      │  │ service      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ ranking-     │  │ voice-       │  │ video-       │      │
│  │ service      │  │ bridge       │  │ orchestrator │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Supabase    │  │    Redis     │  │   Kafka      │      │
│  │  (Postgres)  │  │  (Upstash)   │  │  (messaging) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

- **Admin App**: Next.js 15.1.6, React 18, TypeScript 5.5.4
- **PWAs**: Vite 6, React 18, TailwindCSS 3.4
- **Desktop**: Tauri 2.0 (Rust + WebView)

### Backend

- **Edge Functions**: Deno 2.x (Supabase Functions)
- **Microservices**: NestJS 10.x, Express 4.x
- **Language**: TypeScript 5.5.4 (aligned across all packages)

### Data & Storage

- **Primary DB**: Supabase (PostgreSQL 15)
- **Agent DB**: PostgreSQL (separate instance via Prisma)
- **Cache**: Redis (Upstash)
- **Message Queue**: Kafka
- **File Storage**: Supabase Storage

### AI & Integrations

- **LLMs**: OpenAI GPT-4, Google Gemini, Anthropic Claude
- **Vector DB**: Supabase pgvector
- **WhatsApp**: Meta Business API
- **Payments**: MoMo, Revolut

---

## Architecture Layers

### 1. Client Layer

**WhatsApp Interface**

- Entry point for 90% of users
- Natural language interaction
- SMS fallback for USSD

**Admin Dashboard**

- Next.js 15 app in `admin-app/`
- Real-time analytics
- User management
- Settings configuration

**Progressive Web Apps**

- `waiter-pwa/` - Restaurant staff interface
- `real-estate-pwa/` - Property management
- `client-pwa/` - Customer mobile app (new)

### 2. Edge Layer (Supabase Functions)

All edge functions located in `supabase/functions/`

**WhatsApp Webhook Handlers**:

```
wa-webhook-core/         # Main router (validates, logs, routes)
wa-webhook-ai-agents/    # AI agent orchestration
wa-webhook-mobility/     # Ride booking, tracking
wa-webhook-wallet/       # Payments, transfers
wa-webhook-jobs/         # Job marketplace
wa-webhook-property/     # Real estate listings
wa-webhook-insurance/    # Insurance quotes
wa-webhook-marketplace/  # General marketplace
```

**Admin Functions**:

```
admin-settings/          # Platform configuration
admin-stats/             # Analytics & reporting
admin-users/             # User management
admin-trips/             # Trip oversight
```

### 3. Microservices Layer

Located in `services/`

**Core Services**:

1. **agent-core** (NestJS)
   - AI agent orchestration
   - Agent state management
   - Tool execution
   - Located: `services/agent-core/`

2. **profile** (Express)
   - User profile CRUD
   - Preferences management
   - Located: `services/profile/`

3. **wallet-service** (Express)
   - Balance management
   - Transactions
   - Payment integration
   - Located: `services/wallet-service/`

4. **ranking-service** (Express)
   - Driver/vendor ranking
   - Reputation scores
   - Located: `services/ranking-service/`

5. **voice-bridge** (Express)
   - Voice call handling
   - SIP Trunk integration (MTN and telecoms - **NOT Twilio**)
   - Located: `services/voice-bridge/`

### 4. Shared Packages Layer

Located in `packages/`

**Infrastructure Packages**:

- `@easymo/commons` - Logging, utilities, auth
- `@easymo/db` - Prisma client for Agent-Core DB
- `@easymo/messaging` - Kafka wrappers
- `@easymo/media-utils` - Audio/video processing (NEW)

**AI Packages**:

- `@easymo/agents` - Pre-built AI agents
- `@easymo/ai-core` - Base agent framework
- `@easymo/ai` - AI orchestration

**Utility Packages**:

- `@va/shared` - Shared TypeScript types
- `@easymo/ui` - Shared UI components
- `@easymo/localization` - i18n support

---

## Service Architecture

### Agent-Core Service

```
services/agent-core/
├── src/
│   ├── agents/         # Agent implementations
│   ├── tools/          # Agent tools
│   ├── memory/         # Conversation memory
│   ├── telemetry/      # Observability
│   └── main.ts         # Entry point
├── Dockerfile
└── package.json
```

**Key Features**:

- Multi-agent orchestration
- Tool execution framework
- Conversation memory (Redis)
- OpenAI, Gemini, Claude support

### WhatsApp Webhook Flow

```
1. Meta sends webhook → wa-webhook-core
2. Core validates signature
3. Core logs event with correlation ID
4. Core routes to specific handler:
   - AI message → wa-webhook-ai-agents
   - Payment → wa-webhook-wallet
   - Booking → wa-webhook-mobility
5. Handler processes & responds
6. Response sent back through Meta API
```

---

## Data Flow

### Message Processing Flow

```
WhatsApp User sends message
       ↓
Meta Business API
       ↓
wa-webhook-core (validation, logging)
       ↓
wa-webhook-ai-agents (if AI needed)
       ↓
agent-core service (agent execution)
       ↓
External APIs (if needed)
       ↓
Response formatted
       ↓
Sent back through Meta API
       ↓
User receives response
```

### Payment Flow

```
User initiates payment via WhatsApp
       ↓
wa-webhook-wallet
       ↓
wallet-service (create transaction)
       ↓
MoMo/Revolut API
       ↓
Webhook callback
       ↓
Transaction updated
       ↓
User notified
```

---

## Package Structure

### Monorepo Organization

```
easymo-/
├── packages/              # Shared libraries
│   ├── commons/          # @easymo/commons
│   ├── db/               # @easymo/db
│   ├── agents/           # @easymo/agents
│   ├── media-utils/      # @easymo/media-utils (NEW)
│   └── ...
├── services/              # Microservices
│   ├── agent-core/
│   ├── wallet-service/
│   └── ...
├── admin-app/             # Next.js admin dashboard
├── waiter-pwa/            # Waiter PWA
├── supabase/
│   ├── functions/        # Edge functions
│   ├── migrations/       # SQL migrations
│   └── seed/             # Seed data
└── scripts/               # Automation scripts
    ├── audit/
    ├── codemod/
    ├── maintenance/
    ├── security/
    └── verify/
```

---

## Deployment Topology

### Production Environment

```
┌─────────────────────────────────────────────┐
│           Cloudflare (CDN + DDoS)          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Supabase (Edge Functions)           │
│  • Auto-scaling                             │
│  • Global distribution                      │
│  • Rate limiting                            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      Microservices (GCP/Cloud Run)          │
│  • Container-based                          │
│  • Auto-scaling                             │
│  • Health checks                            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Data Layer                          │
│  • Supabase DB (primary)                    │
│  • Redis (Upstash)                          │
│  • Kafka (Confluent Cloud)                  │
└─────────────────────────────────────────────┘
```

### Development Environment

```
Local Machine
  ├── pnpm dev (Vite dev server)
  ├── supabase start (local Supabase)
  ├── docker-compose (services)
  └── Redis/Kafka (Docker)
```

---

## Security Architecture

### Authentication Flow

1. **User Auth**: Supabase Auth (JWT)
2. **Service Auth**: Service role keys (server-side only)
3. **Webhook Auth**: Signature verification (Meta, payment providers)

### Row-Level Security (RLS)

All Supabase tables enforce RLS policies:

- Users can only access their own data
- Admin role for elevated permissions
- Service role bypasses RLS (server-side only)

### Secrets Management

- **Development**: `.env.local` (gitignored)
- **Production**: Environment variables (Cloud Run/Supabase)
- **Never**: VITE*\* or NEXT_PUBLIC*\* prefixes for secrets

---

## Observability

### Logging

**Structured Logging** (enforced):

```typescript
import { childLogger } from "@easymo/commons";
const log = childLogger({ service: "wallet-service" });

log.info({ event: "payment_processed", txId, amount }, "Payment successful");
```

**Correlation IDs**: Every request tracked with unique ID

### Monitoring

- **Sentry**: Error tracking
- **Supabase Analytics**: Usage metrics
- **Custom Metrics**: Event counters via observability package

### Compliance

Run compliance audit:

```bash
node scripts/audit/observability-compliance.mjs
```

---

## Scaling Strategy

### Horizontal Scaling

- Edge functions: Auto-scale with Supabase
- Microservices: Cloud Run auto-scaling
- Database: Supabase connection pooling

### Vertical Scaling

- Database: Upgrade Supabase tier
- Redis: Upgrade Upstash tier
- Services: Increase container resources

---

## Development Workflow

### Local Development

```bash
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Build shared packages
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

# 3. Start services
supabase start
docker-compose up -d

# 4. Run dev server
pnpm dev
```

### Testing

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

### Deployment

```bash
# Edge functions
pnpm functions:deploy

# Microservices
docker build && docker push
gcloud run deploy

# Admin app
cd admin-app && npm run build
```

---

## Recent Changes (Post-Refactoring)

### Package Structure

- ✅ Added `@easymo/media-utils` for audio processing
- ✅ Deprecated `admin-app-v2`
- ✅ Aligned TypeScript to 5.5.4 across 28 packages

### Code Quality

- ✅ ESLint zero warnings enforced
- ✅ Jest → Vitest migration
- ✅ Console.log → structured logging (72 instances)

### Infrastructure

- ✅ 6 automation scripts created
- ✅ Observability compliance framework
- ✅ CI/CD workflows for compliance

---

## References

- **API Documentation**: `docs/API_DOCUMENTATION.md`
- **Ground Rules**: `docs/GROUND_RULES.md`
- **Refactoring Progress**: `REFACTORING_PROGRESS.md`
- **Quick Start**: `REFACTORING_QUICKSTART.md`

---

**Maintained by**: EasyMO Engineering Team  
**Last Review**: 2025-11-27  
**Next Review**: 2026-Q1
