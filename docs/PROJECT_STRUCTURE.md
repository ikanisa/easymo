# EasyMO Project Structure

This document provides a comprehensive overview of the EasyMO repository structure, including all microservices, workspace packages, and their dependencies.

## Table of Contents

- [Overview](#overview)
- [Repository Layout](#repository-layout)
- [Microservices](#microservices)
- [Workspace Packages](#workspace-packages)
- [Applications](#applications)
- [Database & Migrations](#database--migrations)
- [Configuration Files](#configuration-files)
- [Documentation](#documentation)
- [Dependency Graph](#dependency-graph)
- [Development Workflow](#development-workflow)

---

## Overview

EasyMO is a monorepo managed with **pnpm workspaces**. It contains:

- **11 Microservices** for distributed functionality
- **4 Workspace Packages** for shared libraries
- **4 Applications** (admin apps, APIs)
- **Supabase Edge Functions** for serverless operations
- **Database migrations** for schema management

**Package Manager:** pnpm (v10.18.3 or higher) - **MANDATORY**  
**Node Version:** 18.18.0 or higher  
**Build Tool:** Vite, TypeScript, Next.js (depending on project)

---

## Repository Layout

```
easymo/
├── .github/               # GitHub Actions workflows and configuration
│   └── workflows/         # CI/CD pipeline definitions
├── admin-app/             # Next.js admin application (legacy)
├── apps/                  # Modern applications
│   ├── agent-core/        # Agent orchestration API
│   ├── api/               # Main API gateway
│   ├── sip-webhook/       # SIP event handler
│   └── voice-bridge/      # Voice/Twilio bridge
├── docs/                  # Documentation
│   ├── GROUND_RULES.md    # Development standards
│   ├── CI_WORKFLOWS.md    # CI/CD documentation
│   ├── TROUBLESHOOTING.md # Common issues
│   ├── ENV_VARIABLES.md   # Environment variables
│   └── ...                # Additional docs
├── packages/              # Shared workspace packages
│   ├── commons/           # Common utilities
│   ├── db/                # Database client (Prisma)
│   ├── messaging/         # Message queue client
│   └── shared/            # Shared types & utilities
├── scripts/               # Build and utility scripts
│   ├── assert-no-service-role-in-client.mjs
│   ├── check-schema-alignment.mjs
│   └── ...
├── services/              # Microservices
│   ├── agent-core/        # Agent orchestration service
│   ├── attribution-service/     # Attribution tracking
│   ├── broker-orchestrator/     # Message broker
│   ├── buyer-service/           # Buyer operations
│   ├── ranking-service/         # Marketplace ranking
│   ├── reconciliation-service/  # Payment reconciliation
│   ├── sip-ingress/             # SIP gateway
│   ├── vendor-service/          # Vendor operations
│   ├── voice-bridge/            # Voice/realtime bridge
│   ├── wallet-service/          # Wallet & ledger
│   └── whatsapp-bot/            # WhatsApp integration
├── supabase/              # Supabase configuration
│   ├── functions/         # Edge functions (Deno)
│   ├── migrations/        # SQL migration files
│   └── config.toml        # Supabase config
├── tests/                 # Integration and E2E tests
├── .env.example           # Environment variable template
├── package.json           # Root workspace configuration
├── pnpm-workspace.yaml    # Workspace definitions
├── tsconfig.base.json     # Base TypeScript configuration
└── README.md              # Project overview

```

---

## Microservices

### 1. Agent-Core Service

**Location:** `services/agent-core/`  
**Port:** 4000  
**Language:** TypeScript (NestJS)

**Purpose:**  
Orchestrates AI agents, manages chat sessions, and coordinates with OpenAI API for conversational experiences.

**Key Features:**
- Agent session management
- OpenAI integration
- Conversation state handling
- Multi-tenant support

**Dependencies:**
- `@easymo/commons` - Logging and utilities
- `@easymo/db` - Database access
- PostgreSQL (Agent-Core DB)
- Redis (session storage)

**Environment Variables:**
```bash
AGENT_CORE_URL=http://localhost:4000
AGENT_CORE_INTERNAL_TOKEN=internal-admin-token
OPENAI_API_KEY=sk-...
FEATURE_AGENT_CHAT=1
```

**API Endpoints:**
- `POST /agents/sessions` - Create agent session
- `GET /agents/sessions/:id` - Get session details
- `POST /agents/chat` - Send message to agent

---

### 2. Voice-Bridge Service

**Location:** `services/voice-bridge/` and `apps/voice-bridge/`  
**Port:** 4100  
**Language:** TypeScript (NestJS)

**Purpose:**  
Bridges Twilio Media Streams with OpenAI Realtime API for voice conversations.

**Key Features:**
- WebSocket connections to Twilio
- Real-time audio streaming
- OpenAI Realtime API integration
- Kafka event emission
- Live call monitoring

**Dependencies:**
- Twilio SDK
- OpenAI SDK
- Kafka client
- Redis

**Environment Variables:**
```bash
VOICE_BRIDGE_API_URL=http://localhost:4100
TWILIO_MEDIA_AUTH_TOKEN=your-token
OPENAI_REALTIME_URL=wss://api.openai.com/v1/realtime
KAFKA_BROKERS=localhost:29092
```

**Topics:**
- `voice.contact.events` - Call lifecycle events
- `voice.media.events` - Audio stream events

---

### 3. Wallet Service

**Location:** `services/wallet-service/`  
**Port:** 4400  
**Language:** TypeScript (NestJS)

**Purpose:**  
Manages double-entry ledger for financial transactions, account balances, and payment processing.

**Key Features:**
- Double-entry bookkeeping
- Transaction history
- Account balance tracking
- Commission management
- Audit trail

**Dependencies:**
- `@easymo/db` - Database access
- PostgreSQL (Agent-Core DB)

**Environment Variables:**
```bash
WALLET_SERVICE_URL=http://localhost:4400
COMMISSION_ACCOUNT_ID=uuid
PLATFORM_ACCOUNT_ID=uuid
FEATURE_WALLET_SERVICE=1
```

**API Endpoints:**
- `POST /accounts` - Create account
- `GET /accounts/:id/balance` - Get balance
- `POST /transactions` - Record transaction
- `GET /ledger` - Query ledger entries

---

### 4. Ranking Service

**Location:** `services/ranking-service/`  
**Port:** 4500  
**Language:** TypeScript (NestJS)

**Purpose:**  
Ranks marketplace vendors and products based on various criteria.

**Key Features:**
- Vendor scoring
- Product ranking algorithms
- Real-time rank updates
- A/B testing support

**Dependencies:**
- `@easymo/db` - Database access
- Supabase Admin API

**Environment Variables:**
```bash
MARKETPLACE_RANKING_URL=http://localhost:4500
FEATURE_MARKETPLACE_RANKING=1
EASYMO_ADMIN_API_BASE=https://...
```

---

### 5. Vendor Service

**Location:** `services/vendor-service/`  
**Port:** 4600  
**Language:** TypeScript (NestJS)

**Purpose:**  
Manages vendor onboarding, profiles, inventory, and operations.

**Key Features:**
- Vendor registration
- Inventory management
- Order fulfillment
- Product catalog

**Dependencies:**
- `@easymo/db` - Database access
- PostgreSQL (Agent-Core DB)

**Environment Variables:**
```bash
MARKETPLACE_VENDOR_URL=http://localhost:4600
FEATURE_MARKETPLACE_VENDOR=1
```

---

### 6. Buyer Service

**Location:** `services/buyer-service/`  
**Port:** 4700  
**Language:** TypeScript (NestJS)

**Purpose:**  
Handles buyer operations, shopping cart, orders, and checkout.

**Key Features:**
- Shopping cart management
- Order placement
- Payment processing
- Order history

**Dependencies:**
- `@easymo/db` - Database access
- Wallet Service
- Supabase Admin API

**Environment Variables:**
```bash
MARKETPLACE_BUYER_URL=http://localhost:4700
WALLET_SERVICE_URL=http://localhost:4400
FEATURE_MARKETPLACE_BUYER=1
```

---

### 7. SIP Ingress

**Location:** `services/sip-ingress/`  
**Port:** 4200  
**Language:** TypeScript (NestJS)

**Purpose:**  
Normalizes SIP webhook events from telephony providers with idempotency handling.

**Key Features:**
- SIP event normalization
- Webhook signature verification
- Redis-backed idempotency
- Event routing to Kafka

**Dependencies:**
- Redis
- Kafka client

**Environment Variables:**
```bash
PORT=4200
SIGNATURE_SECRET=your-secret
EVENT_TOPIC=voice.sip.events
KAFKA_BROKERS=localhost:29092
```

---

### 8. WhatsApp Bot

**Location:** `services/whatsapp-bot/`  
**Port:** 4300  
**Language:** TypeScript (NestJS)

**Purpose:**  
Handles WhatsApp Business API webhooks and message routing.

**Key Features:**
- Webhook verification
- Message parsing
- Event emission to Kafka
- Opt-out handling

**Dependencies:**
- Kafka client
- Redis
- Meta/WhatsApp API

**Environment Variables:**
```bash
PORT=4300
META_VERIFY_TOKEN=your-token
META_PAGE_TOKEN=your-token
KAFKA_BROKERS=localhost:29092
```

**Topics:**
- `whatsapp.inbound` - Incoming messages
- `whatsapp.outbound` - Outgoing messages

---

### 9. Broker Orchestrator

**Location:** `services/broker-orchestrator/`  
**Language:** TypeScript (NestJS)

**Purpose:**  
Central message broker that coordinates events across WhatsApp, Voice, and internal services.

**Key Features:**
- Multi-channel event routing
- Retry logic
- Dead letter queue
- Event transformation

**Dependencies:**
- Kafka client
- Redis
- Agent-Core API
- Wallet Service API

**Environment Variables:**
```bash
KAFKA_BROKERS=localhost:29092
WHATSAPP_TOPIC=whatsapp.inbound
VOICE_CONTACT_TOPIC=voice.contact.events
BROKER_OUTBOUND_TOPIC=broker.outbound
AGENT_CORE_URL=http://localhost:4000
```

---

### 10. Attribution Service

**Location:** `services/attribution-service/`  
**Language:** TypeScript (NestJS)

**Purpose:**  
Tracks user attribution, marketing campaigns, and conversion funnels.

**Key Features:**
- Campaign tracking
- Attribution modeling
- Conversion analytics
- Source attribution

**Dependencies:**
- `@easymo/db` - Database access
- PostgreSQL

---

### 11. Reconciliation Service

**Location:** `services/reconciliation-service/`  
**Language:** TypeScript (NestJS)

**Purpose:**  
Reconciles payment transactions, handles MoMo SMS parsing, and matches transactions.

**Key Features:**
- Payment reconciliation
- SMS parsing (Mobile Money)
- Transaction matching
- Dispute resolution

**Dependencies:**
- `@easymo/db` - Database access
- PostgreSQL

**Environment Variables:**
```bash
MOMO_SMS_HMAC_SECRET=your-secret
MOMO_ALLOCATOR_BATCH_SIZE=10
```

---

## Workspace Packages

### 1. @easymo/commons

**Location:** `packages/commons/`  
**Type:** Shared library

**Purpose:**  
Common utilities, logger, feature flags, and helpers used across all services.

**Exports:**
```typescript
// Logging
export { logger, childLogger } from './logger';

// Feature flags
export { isFeatureEnabled, FeatureFlag } from './feature-flags';

// Utilities
export { maskPII, maskPhoneNumber } from './pii';
export { validateUUID, parseJSON } from './utils';
```

**Dependencies:**
- pino (logging)
- zod (validation)

**Used By:** All services and applications

---

### 2. @easymo/db

**Location:** `packages/db/`  
**Type:** Database client

**Purpose:**  
Prisma client for Agent-Core database, migrations, and schema management.

**Exports:**
```typescript
export { PrismaClient } from '@prisma/client';
export type { User, Transaction, Account } from '@prisma/client';
```

**Scripts:**
```bash
pnpm prisma:generate     # Generate client
pnpm prisma:migrate:dev  # Create migration
pnpm prisma:migrate:deploy  # Apply migrations
```

**Used By:** Agent-Core, Wallet, Vendor, Buyer, Ranking services

---

### 3. @easymo/messaging

**Location:** `packages/messaging/`  
**Type:** Message queue library

**Purpose:**  
Kafka client wrapper for event-driven communication between services.

**Exports:**
```typescript
export { KafkaProducer, KafkaConsumer } from './kafka';
export { MessageBus } from './message-bus';
export type { Event, Message } from './types';
```

**Used By:** Voice-Bridge, WhatsApp Bot, Broker Orchestrator, SIP Ingress

---

### 4. @va/shared (@easymo/shared)

**Location:** `packages/shared/`  
**Type:** Shared types and utilities

**Purpose:**  
Shared TypeScript types, constants, and utilities for frontend and backend.

**Exports:**
```typescript
export type { AdminUser, Trip, Subscription } from './types';
export { CONSTANTS } from './constants';
export { formatCurrency, formatDate } from './formatters';
```

**Used By:** Admin apps, API services

---

## Applications

### 1. Admin App (Next.js)

**Location:** `admin-app/`  
**Framework:** Next.js 13+  
**Port:** 3000

**Purpose:**  
Modern admin dashboard for managing users, trips, subscriptions, and marketplace operations.

**Key Features:**
- User management
- Trip monitoring
- Subscription approval
- Live call dashboard
- Marketplace oversight
- PWA-ready

**Build:**
```bash
pnpm --filter @easymo/admin-app build
pnpm --filter @easymo/admin-app start
```

---

### 2. Station App

**Location:** `station-app/`  
**Framework:** Vite + React

**Purpose:**  
Point-of-sale application for station operators.

---

### 3. API Gateway

**Location:** `apps/api/`  
**Framework:** Express/NestJS

**Purpose:**  
Main API gateway that routes requests to appropriate services.

---

### 4. Agent-Core App

**Location:** `apps/agent-core/`  
**Framework:** NestJS

**Purpose:**  
Alternative implementation/wrapper for Agent-Core service.

---

## Database & Migrations

### Supabase (Primary Database)

**Location:** `supabase/migrations/`  
**Type:** PostgreSQL with RLS

**Purpose:**  
Main application database with row-level security for multi-tenancy.

**Key Tables:**
- `profiles` - User profiles
- `trips` - Trip records
- `subscriptions` - Subscription requests
- `settings` - Application settings
- `marketplace_*` - Marketplace entities
- `whatsapp_*` - WhatsApp conversation data

**Migration Format:**
```
YYYYMMDDHHMMSS_description.sql
```

**Commands:**
```bash
# Create new migration
supabase migration new description

# Apply migrations locally
supabase db push

# Export schema
supabase db dump --schema public > latest_schema.sql

# Verify alignment
pnpm schema:verify
```

**Rules:**
- ✅ Additive-only (no DROP, no destructive ALTER)
- ✅ Include BEGIN/COMMIT
- ✅ Use IF NOT EXISTS
- ✅ Update `latest_schema.sql` after changes

---

### Agent-Core Database

**Location:** `packages/db/prisma/`  
**Type:** PostgreSQL (Prisma ORM)

**Purpose:**  
Dedicated database for agent operations, wallet, and marketplace services.

**Key Models:**
- `User` - System users
- `Account` - Wallet accounts
- `Transaction` - Financial transactions
- `LedgerEntry` - Double-entry ledger
- `Agent` - AI agent configurations
- `Session` - Chat sessions

**Commands:**
```bash
# Generate Prisma client
pnpm --filter @easymo/db prisma:generate

# Create migration
pnpm --filter @easymo/db prisma:migrate:dev

# Apply migrations
pnpm --filter @easymo/db prisma:migrate:deploy
```

---

## Configuration Files

### Root Configuration

| File | Purpose |
|------|---------|
| `package.json` | Root workspace configuration, scripts |
| `pnpm-workspace.yaml` | Workspace package definitions |
| `tsconfig.base.json` | Base TypeScript configuration |
| `tsconfig.json` | Root TypeScript config (extends base) |
| `.env.example` | Environment variable template |
| `.gitignore` | Git ignore patterns |
| `.npmrc` | npm/pnpm configuration |
| `Makefile` | Common development commands |

---

### Build Configuration

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build configuration |
| `vitest.config.ts` | Vitest test configuration |
| `eslint.config.js` | ESLint linting rules |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration |

---

### TypeScript Configuration Strategy

```
tsconfig.base.json           # Base config for all packages
├── tsconfig.json            # Root project config
├── services/*/tsconfig.json # Service-specific configs
├── apps/*/tsconfig.json     # App-specific configs
└── packages/*/tsconfig.json # Package-specific configs
```

**Base Configuration:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

**Service Configuration:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "outDir": "./dist",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Documentation

### Core Documentation

Located in `docs/`:

| Document | Purpose |
|----------|---------|
| `GROUND_RULES.md` | Development standards (logging, security, feature flags) |
| `CI_WORKFLOWS.md` | CI/CD pipeline documentation |
| `TROUBLESHOOTING.md` | Common issues and solutions |
| `ENV_VARIABLES.md` | Environment variable reference |
| `PROJECT_STRUCTURE.md` | This document |
| `architecture.md` | System architecture overview |
| `baskets-architecture.md` | Baskets (Ibimina) feature architecture |
| `OBSERVABILITY_PLAN.md` | Logging and monitoring strategy |
| `PRIVACY_SECURITY.md` | Security policies |

---

### API Documentation

Located in `docs/` and service READMEs:

- `OPENAI_RESPONSES_API.md` - OpenAI integration guide
- `WHATSAPP_FLOWS.md` - WhatsApp Flow specifications
- `SMS_SPEC.md` - SMS integration
- `OCR_SPEC.md` - OCR processing

---

### Runbooks

Located in `docs/runbooks/`:

- Deployment procedures
- Incident response
- Operational procedures

---

## Dependency Graph

### Build Order

Services and packages must be built in dependency order:

```
1. @easymo/commons
2. @easymo/db
3. @easymo/messaging
4. @va/shared (@easymo/shared)
5. All services (can be parallel)
6. Applications
```

**Build Command:**
```bash
# Build in correct order
pnpm --filter @easymo/commons build
pnpm --filter @easymo/db build
pnpm --filter @easymo/messaging build
pnpm --filter @va/shared build
pnpm build  # Builds everything else
```

---

### Service Dependencies

```mermaid
graph TD
    A[Admin App] --> B[Supabase Edge Functions]
    A --> C[Agent-Core API]
    
    C --> D[@easymo/db]
    C --> E[@easymo/commons]
    
    F[Voice-Bridge] --> E
    F --> G[@easymo/messaging]
    F --> H[Kafka]
    
    I[WhatsApp Bot] --> G
    I --> H
    
    J[Broker Orchestrator] --> G
    J --> H
    J --> C
    J --> K[Wallet Service]
    
    K --> D
    K --> E
    
    L[Buyer Service] --> D
    L --> E
    L --> K
    
    M[Vendor Service] --> D
    M --> E
    
    N[Ranking Service] --> D
    N --> E
```

---

## Development Workflow

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/ikanisa/easymo.git
cd easymo

# 2. Install pnpm (if not installed)
npm install -g pnpm@10.18.3

# 3. Install dependencies
pnpm install

# 4. Set up environment
cp .env.example .env
# Edit .env and replace all CHANGEME_* values

# 5. Start Supabase locally
supabase start

# 6. Apply migrations
supabase db push
pnpm --filter @easymo/db prisma:migrate:deploy

# 7. Build shared packages
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm --filter @easymo/db build
pnpm --filter @easymo/messaging build
```

---

### Running Services

**Start all services:**
```bash
# Option 1: Use docker-compose
docker-compose -f docker-compose.agent-core.yml up

# Option 2: Start individually
pnpm --filter agent-core dev
pnpm --filter voice-bridge dev
pnpm --filter wallet-service dev
pnpm --filter whatsapp-bot dev
```

**Start admin app:**
```bash
pnpm --filter @easymo/admin-app dev
# or
make admin
```

---

### Common Tasks

**Lint all code:**
```bash
pnpm lint
```

**Type check:**
```bash
pnpm type-check
```

**Run tests:**
```bash
pnpm test
```

**Build everything:**
```bash
pnpm build
```

**Clean build:**
```bash
# Remove build artifacts
find . -type d -name "dist" -exec rm -rf {} +
find . -type d -name ".next" -exec rm -rf {} +

# Reinstall and rebuild
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

---

### Adding a New Service

1. **Create service directory:**
   ```bash
   mkdir services/my-service
   cd services/my-service
   ```

2. **Initialize package:**
   ```bash
   pnpm init
   ```

3. **Configure package.json:**
   ```json
   {
     "name": "my-service",
     "version": "1.0.0",
     "scripts": {
       "dev": "tsx watch src/main.ts",
       "build": "tsc",
       "start": "node dist/main.js"
     },
     "dependencies": {
       "@easymo/commons": "workspace:*",
       "@easymo/db": "workspace:*"
     }
   }
   ```

4. **Create tsconfig.json:**
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "./dist"
     },
     "include": ["src/**/*"]
   }
   ```

5. **Add to pnpm-workspace.yaml** (if not using wildcard)

6. **Create README.md** documenting:
   - Service purpose
   - API endpoints
   - Environment variables
   - Dependencies

---

### Adding a New Package

1. **Create package directory:**
   ```bash
   mkdir packages/my-package
   cd packages/my-package
   ```

2. **Initialize with proper exports:**
   ```json
   {
     "name": "@easymo/my-package",
     "version": "1.0.0",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": "./dist/index.js"
     },
     "scripts": {
       "build": "tsc",
       "dev": "tsc --watch"
     }
   }
   ```

3. **Create src/index.ts:**
   ```typescript
   export * from './lib';
   ```

4. **Add to dependent packages:**
   ```json
   {
     "dependencies": {
       "@easymo/my-package": "workspace:*"
     }
   }
   ```

---

## Best Practices

### Directory Structure

✅ **DO:**
- Keep services independent
- Share code via workspace packages
- Use consistent naming conventions
- Include README in each service/package

❌ **DON'T:**
- Create circular dependencies
- Share code by copying
- Mix service concerns

---

### TypeScript Configuration

✅ **DO:**
- Extend from `tsconfig.base.json`
- Use path mapping for local imports
- Enable strict mode
- Generate declaration files for packages

❌ **DON'T:**
- Duplicate compiler options
- Use different TypeScript versions
- Disable strict checks

---

### Dependency Management

✅ **DO:**
- Use `workspace:*` protocol
- Pin versions in root package.json
- Keep dependencies up to date
- Run security audits

❌ **DON'T:**
- Mix package managers (npm, yarn)
- Install packages globally
- Use incompatible versions

---

## Related Documentation

- [GROUND_RULES.md](./GROUND_RULES.md) - Development standards
- [CI_WORKFLOWS.md](./CI_WORKFLOWS.md) - CI/CD pipelines
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [ENV_VARIABLES.md](./ENV_VARIABLES.md) - Environment configuration
- [README.md](../README.md) - Project overview

---

**Last Updated**: 2025-10-29  
**Maintained by**: EasyMO Platform Team
