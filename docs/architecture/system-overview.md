# System Architecture Overview

## High-Level Architecture

```
WhatsApp Cloud API (Meta)
         │
         │ Webhook Events (HTTPS + HMAC-SHA256)
         ▼
┌─────────────────────────────────────────┐
│      Supabase Edge Functions            │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │      wa-webhook-core               │ │
│  │  • Security Middleware             │ │
│  │  • Router                          │ │
│  │  • Home Menu Handler               │ │
│  └────────┬───────────────────────────┘ │
│           │                              │
│    ┌──────┼──────┐                      │
│    ▼      ▼      ▼                      │
│  ┌────┐ ┌────┐ ┌────┐                   │
│  │Profile│Mobility│Insurance            │ │
│  └────┘ └────┘ └────┘                   │
│           │                              │
│  ┌────────┴───────────┐                 │
│  │   Shared Modules   │                 │
│  │  • Config • Cache  │                 │
│  │  • Security • State│                 │
│  └────────────────────┘                 │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      Supabase PostgreSQL                │
│  • profiles  • trips                    │
│  • wallets   • insurance_leads          │
│  • user_state                           │
└─────────────────────────────────────────┘
```

## Service Responsibilities

### wa-webhook-core

**Purpose:** Central entry point and message router

**Responsibilities:**

- Webhook verification (GET requests)
- Signature verification (HMAC-SHA256)
- Message routing based on:
  - Interactive message IDs
  - Text keywords
  - User state
- Home menu display
- Service health aggregation

### wa-webhook-profile

**Purpose:** User profile and wallet management

**Responsibilities:**

- Profile CRUD operations
- Wallet balance management
- Token transfers
- Transaction history
- Language preferences

**Database Tables:**

- `profiles`
- `wallets`
- `wallet_transactions`

### wa-webhook-mobility

**Purpose:** Ride booking and transport services

**Responsibilities:**

- Nearby driver/passenger search
- Trip scheduling
- Trip lifecycle management
- Driver verification
- Rating and feedback

**Database Tables:**

- `trips`
- `trip_ratings`
- `driver_verifications`

### wa-webhook-insurance

**Purpose:** Insurance document processing and claims

**Responsibilities:**

- Document upload handling
- OCR processing
- Insurance data extraction
- Claims submission
- Claims status tracking

**Database Tables:**

- `insurance_leads`
- `insurance_claims`
- `insurance_media_queue`

## Data Flow

### Message Processing Flow

```
1. User sends WhatsApp message
   ↓
2. Meta sends webhook to wa-webhook-core
   ↓
3. Security middleware validates signature
   ↓
4. Router determines destination
   ↓
5. Forward to appropriate service
   ↓
6. Service processes message
   ↓
7. Return success to Meta
```

### State Management Flow

```
1. User initiates flow (e.g., "book ride")
   ↓
2. Set state: "mobility_nearby_select"
   ↓
3. User selects vehicle type
   ↓
4. Transition to: "mobility_nearby_location"
   ↓
5. User shares location
   ↓
6. Clear state (flow complete)
```

## Security Architecture

### Authentication Flow

```
WhatsApp API → HMAC-SHA256 Signature → Core Service → Verify with APP_SECRET
```

### Security Layers

1. **Transport Security:** HTTPS/TLS 1.3
2. **Webhook Authentication:** HMAC-SHA256 signatures
3. **Input Validation:** Sanitization, SQL injection prevention
4. **Rate Limiting:** Per-user and global limits
5. **Audit Logging:** All sensitive operations logged

## Caching Architecture

```
Request → Response Cache (1 min TTL)
       → Profile Cache (5 min TTL)
       → State Cache (1 min TTL)
       → Location Cache (30 min TTL)
       → Database (PostgreSQL)
```

## Deployment Architecture

```
GitHub Repository
    ↓
GitHub Actions CI/CD
    ↓
Lint → Test → Deploy
    ↓
Supabase Platform
  • Edge Functions (Deno Runtime)
  • PostgreSQL DB
```

_Last Updated: 2025-12-02_
