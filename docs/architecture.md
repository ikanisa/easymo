# easyMO Architecture Documentation

## Overview

easyMO is a mobility and financial services platform built on WhatsApp Business, Supabase Edge Functions, and a PostgreSQL database with PostGIS extensions. The platform enables users to access insurance, savings groups (baskets), QR payments, and dining services through conversational AI.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Overview](#component-overview)
3. [Data Flow](#data-flow)
4. [Integration Points](#integration-points)
5. [Deployment Architecture](#deployment-architecture)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WhatsApp Business                         │
│                    (Meta Cloud API)                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTPS POST (webhook)
                           │ X-Hub-Signature-256
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WA-Router Edge Function                        │
│  - Signature Verification (HMAC SHA-256)                         │
│  - Keyword Extraction & Routing                                  │
│  - Idempotency Check (message_id)                                │
│  - Logging & Observability                                       │
└──────────┬───────────┬────────────┬────────────┬─────────────────┘
           │           │            │            │
           │ easymo    │ insurance  │ basket     │ qr/dine
           ▼           ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ WA Main  │ │Insurance │ │ Basket   │ │ QR/Dine  │
    │ Handler  │ │ Handler  │ │ Handler  │ │ Handler  │
    └──────────┘ └──────────┘ └──────────┘ └──────────┘
           │           │            │            │
           └───────────┴────────────┴────────────┘
                           │
                           ▼
           ┌────────────────────────────────────┐
           │     Supabase PostgreSQL DB         │
           │  - PostGIS (geospatial queries)    │
           │  - Row Level Security (RLS)        │
           │  - GIST Indexes                    │
           └────────────────────────────────────┘
```

---

## Component Overview

### 1. WhatsApp Business API

**Purpose**: Primary user interface for the platform.

**Responsibilities**:
- Receive user messages (text, interactive, media)
- Send responses (text, lists, buttons, images)
- Webhook callbacks for message events

**Security**:
- HMAC SHA-256 signature verification
- Webhook verification token

**Configuration**:
- `WABA_PHONE_NUMBER_ID`: WhatsApp Business phone number ID
- `WABA_ACCESS_TOKEN`: Meta access token
- `WA_VERIFY_TOKEN`: Webhook verification token
- `WA_APP_SECRET`: HMAC signing secret

---

### 2. WA-Router Edge Function

**Location**: `supabase/functions/wa-router/`

**Purpose**: Central entry point for all WhatsApp webhook events.

**Responsibilities**:
1. **Webhook Verification**: Handle GET requests from Meta
2. **Signature Verification**: Validate HMAC SHA-256 signatures
3. **Message Normalization**: Extract and normalize message data
4. **Keyword Extraction**: Identify routing keywords (insurance, basket, qr, etc.)
5. **Routing**: Fan-out messages to appropriate handlers
6. **Idempotency**: Prevent duplicate message processing
7. **Logging**: Persist routing decisions to `router_logs`
8. **Feature Flag**: Respect `ROUTER_ENABLED` flag

**Key Functions**:
```typescript
verifySignature(req, rawBody)      // HMAC validation
normalizePayload(payload)          // Extract messages
extractKeyword(text)               // Identify route
getDestinationUrl(keyword)         // Map keyword → URL
forwardToDestination(url, msg)     // Fan-out
isMessageProcessed(messageId)      // Idempotency check
persistRouterLog(...)              // Audit logging
```

**Database Tables Used**:
- `router_keyword_map`: Keyword → route_key mappings
- `router_logs`: Message routing audit log

---

### 3. Handler Edge Functions

#### a. WA-Webhook (Main Handler)

**Location**: `supabase/functions/wa-webhook/`

**Purpose**: Main conversational flow handler for easyMO services.

**Capabilities**:
- Multi-domain routing (insurance, basket, QR, dine)
- State management for conversations
- Interactive menus (lists, buttons)
- Localization (English, Kinyarwanda, French)
- Agent-based conversations

**Key Modules**:
- `router/`: Message routing and context management
- `flows/`: Conversation flow definitions
- `exchange/`: Integration with flow-exchange service
- `notify/`: Notification delivery
- `services/`: External API integrations

#### b. Insurance Handler

**Purpose**: Handle insurance-related messages and OCR processing.

**Features**:
- Quote generation
- Policy attachment via deep-links
- Document upload and OCR
- Insurance renewal reminders

#### c. Basket Handler

**Purpose**: Manage savings groups (Ikimina/SACCO).

**Features**:
- Group creation and invitations
- Contribution tracking
- Loan endorsements
- MoMo payment integration

#### d. QR/Dine Handlers

**Purpose**: QR code generation and dining menu browsing.

**Features**:
- Dynamic QR code generation
- Restaurant menu displays
- Order placement

---

### 4. Deeplink Resolver

**Location**: `supabase/functions/deeplink-resolver/`

**Purpose**: Resolve shortened deep-link tokens to WhatsApp flows.

**Flow**:
1. User clicks short URL (e.g., `easymo.link/JB:ABC123`)
2. Resolver validates token (signature, expiry, binding)
3. Redirects to `wa.me/{number}?text={code}`
4. WhatsApp opens with pre-filled message
5. Router routes message to appropriate handler

**Security**:
- HMAC token signing
- 14-day TTL
- Optional MSISDN binding
- Single-use enforcement
- Expiry tracking

**Database Tables**:
- `deeplink_tokens`: Token metadata
- `deeplink_events`: Resolution audit log

---

### 5. Admin Panel

**Location**: `easymo/admin-app/`

**Purpose**: Web-based administration interface.

**Features**:
- **Router Management**:
  - Keyword map CRUD
  - Logs viewer with filters
  - Real-time routing metrics
- **User Management**:
  - Favorites (locations)
  - Driver profiles
  - Subscription status
- **Driver Management**:
  - Parking locations
  - Availability schedules
  - Performance metrics
- **Scheduling**:
  - Recurring trips
  - Matching configuration
  - Cron job monitoring
- **Feature Flags**:
  - Toggle features on/off
  - Rollout percentages
  - Override settings

**Authentication**:
- Supabase Auth (session-based)
- Role-based access control (RBAC)
- Admin token verification

---

## Data Flow

### Inbound Message Flow

```
1. User sends WhatsApp message
   ↓
2. Meta sends webhook POST to wa-router
   ↓
3. Router verifies signature
   ↓
4. Router checks idempotency (message_id)
   ↓
5. Router extracts keyword (insurance, basket, etc.)
   ↓
6. Router looks up destination URL
   ↓
7. Router validates URL against allowlist
   ↓
8. Router forwards to handler
   ↓
9. Handler processes message
   ↓
10. Handler sends response via WhatsApp API
    ↓
11. Router persists log entry
```

### Outbound Message Flow

```
1. Background job or webhook triggers notification
   ↓
2. Function generates message content
   ↓
3. Function calls WhatsApp Business API
   ↓
4. WhatsApp delivers message to user
   ↓
5. User receives message
```

### Deep-link Flow

```
1. System generates deep-link token
   ↓
2. Token stored in deeplink_tokens table
   ↓
3. Short URL shared with user (SMS, email, etc.)
   ↓
4. User clicks link
   ↓
5. Deeplink resolver validates token
   ↓
6. Resolver increments usage stats
   ↓
7. Resolver redirects to wa.me with code
   ↓
8. WhatsApp opens with pre-filled message
   ↓
9. User sends message
   ↓
10. Router handles message normally
```

---

## Integration Points

### External Services

1. **WhatsApp Business API**
   - Message send/receive
   - Media upload/download
   - Webhook callbacks

2. **MoMo API**
   - Payment collection
   - Balance checks
   - Transaction status

3. **Twilio**
   - Voice calls
   - SIP integration
   - Media streams

4. **OpenAI**
   - Realtime voice agents
   - Document embeddings
   - Conversational AI

5. **Sentry/Logflare** (Optional)
   - Error tracking
   - Log aggregation
   - Performance monitoring

### Internal Services

1. **Flow Exchange**
   - Central flow execution engine
   - State management
   - Intent resolution

2. **Agent Core**
   - Lead management
   - Opt-in/opt-out tracking
   - Agent configuration

3. **Wallet Service**
   - Double-entry ledger
   - Transaction history
   - Balance management

4. **Ranking Service**
   - Vendor ranking
   - Intent matching
   - Quote scoring

---

## Deployment Architecture

### Supabase Edge Functions

**Runtime**: Deno (TypeScript/JavaScript)

**Regions**:
- Primary: us-east-1 (or closest to Rwanda)
- Fallback: Multi-region on upgrade

**Scaling**:
- Auto-scaling based on request volume
- Cold start mitigation via health checks

**Secrets Management**:
- Supabase project secrets
- Environment variables per function

### Database

**Provider**: Supabase PostgreSQL (v15+)

**Extensions**:
- PostGIS (geospatial)
- pgcrypto (UUID generation)
- pgtap (testing)
- pg_cron (scheduled jobs)

**Backups**:
- Automated daily backups (Supabase)
- Point-in-time recovery (PITR)
- Export snapshots for critical tables

**Performance**:
- Connection pooling (pgBouncer)
- GIST indexes for geospatial queries
- Materialized views for analytics

### Admin Panel

**Hosting**: Vercel/Netlify or self-hosted

**Build**:
- Vite + React + TypeScript
- ShadCN UI components
- TailwindCSS

**Authentication**:
- Supabase Auth (JWT)
- Session cookies (httpOnly, secure)

---

## Scalability Considerations

### Current Limits

- WhatsApp: 1,000 messages/second (per phone number)
- Edge Functions: ~1,000 concurrent requests
- Database: ~500 connections (default)

### Optimization Strategies

1. **Database**:
   - Indexed queries (GIST, B-tree)
   - Read replicas for analytics
   - Partitioning for large tables

2. **Caching**:
   - In-memory caching (Edge Function globals)
   - Redis for session state (future)
   - CDN for static assets

3. **Async Processing**:
   - Queue background jobs (pg_cron, BullMQ)
   - Webhook fanout (parallel processing)
   - Batch operations

4. **Monitoring**:
   - Real-time dashboards (Grafana)
   - Alert thresholds (Sentry)
   - Synthetic probes (health checks)

---

## References

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Deno Runtime Docs](https://deno.land/manual)

---

**Last Updated**: 2025-10-28  
**Owner**: easyMO Engineering Team  
**Review Cycle**: Quarterly
