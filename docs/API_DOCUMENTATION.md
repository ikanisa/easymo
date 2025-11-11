# EasyMO Microservices API Documentation

## Overview

This document provides comprehensive API documentation for all EasyMO microservices.

## Service Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  API Gateway │────▶│  Services   │
│  (Admin/WA) │     │   (Supabase) │     │ (Microserv) │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Database   │
                    │  (Postgres)  │
                    └──────────────┘
```

## Services Directory

| Service | Port | Description | Status |
|---------|------|-------------|--------|
| wallet-service | 4400 | Payment processing and wallet management | ✅ Stable |
| ranking-service | 4401 | Vendor ranking and scoring | ✅ Stable |
| vendor-service | 4402 | Vendor management | ⚠️ Partial |
| buyer-service | 4403 | Buyer operations | ✅ Stable |
| agent-core | 4404 | AI agent orchestration | ✅ Stable |
| voice-bridge | 4405 | Voice call handling | ❌ In Development |
| broker-orchestrator | 4406 | Intent brokering | ✅ Stable |

---

## Authentication

All service endpoints require authentication via service token or user JWT.

### Service-to-Service Authentication

```http
POST /api/endpoint
Authorization: Bearer <SERVICE_TOKEN>
Content-Type: application/json
```

### User Authentication

```http
POST /api/endpoint
Authorization: Bearer <USER_JWT>
Content-Type: application/json
```

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token for authentication |
| Content-Type | Yes | application/json |
| X-Correlation-Id | No | Request tracing ID |
| Idempotency-Key | No* | Unique key for idempotent operations (*Required for financial operations) |

---

## Wallet Service

**Base URL:** `http://localhost:4400`

### POST /wallet/transfer

Transfer funds between wallet accounts.

**Authentication:** Required  
**Idempotent:** Yes

**Request:**
```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "sourceAccountId": "550e8400-e29b-41d4-a716-446655440001",
  "destinationAccountId": "550e8400-e29b-41d4-a716-446655440002",
  "amount": 1000.00,
  "currency": "USD",
  "reference": "Payment for order #12345",
  "metadata": {
    "orderId": "12345",
    "description": "Product purchase"
  },
  "product": "marketplace"
}
```

**Headers:**
```http
Authorization: Bearer <token>
Idempotency-Key: <unique-key>
Content-Type: application/json
```

**Response (201 Created):**
```json
{
  "transaction": {
    "id": "tx_550e8400-e29b-41d4-a716-446655440003",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "marketplace",
    "reference": "Payment for order #12345",
    "metadata": {
      "orderId": "12345",
      "description": "Product purchase"
    },
    "createdAt": "2024-03-15T10:30:00Z"
  },
  "entries": [
    {
      "accountId": "550e8400-e29b-41d4-a716-446655440001",
      "amount": "1000.00",
      "direction": "debit"
    },
    {
      "accountId": "550e8400-e29b-41d4-a716-446655440002",
      "amount": "1000.00",
      "direction": "credit"
    }
  ],
  "commissionAmount": null
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | validation_error | Invalid request parameters |
| 403 | feature_disabled | Wallet service is disabled |
| 404 | account_not_found | One or more accounts not found |
| 409 | insufficient_funds | Source account has insufficient balance |
| 429 | rate_limit_exceeded | Too many requests |

**Error Example:**
```json
{
  "error": "insufficient_funds",
  "message": "Account balance too low",
  "details": {
    "accountId": "550e8400-e29b-41d4-a716-446655440001",
    "balance": "500.00",
    "required": "1000.00"
  }
}
```

### GET /wallet/accounts/:id

Get account summary including balance and recent transactions.

**Authentication:** Required

**Request:**
```http
GET /wallet/accounts/550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "account": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "ownerType": "vendor",
    "ownerId": "vendor_123",
    "currency": "USD",
    "balance": "5000.00",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-03-15T10:30:00Z"
  },
  "recentTransactions": [
    {
      "id": "tx_001",
      "type": "marketplace",
      "amount": "1000.00",
      "direction": "credit",
      "createdAt": "2024-03-15T10:30:00Z"
    }
  ]
}
```

### GET /health

Health check endpoint.

**Authentication:** Not required

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-03-15T10:30:00Z",
  "version": "0.1.0"
}
```

---

## Ranking Service

**Base URL:** `http://localhost:4401`

### POST /ranking/calculate

Calculate vendor ranking score.

**Authentication:** Required

**Request:**
```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "vendorId": "vendor_123",
  "metrics": {
    "completionRate": 0.95,
    "averageRating": 4.5,
    "totalOrders": 150,
    "responseTime": 300
  }
}
```

**Response (200 OK):**
```json
{
  "vendorId": "vendor_123",
  "score": 85.5,
  "rank": 12,
  "breakdown": {
    "completionRate": 23.75,
    "averageRating": 22.5,
    "volume": 20.0,
    "speed": 19.25
  },
  "calculatedAt": "2024-03-15T10:30:00Z"
}
```

---

## Agent Core Service

**Base URL:** `http://localhost:4404`

### POST /agent/execute

Execute an AI agent workflow.

**Authentication:** Required

**Request:**
```json
{
  "agentType": "property-rental",
  "userId": "user_123",
  "conversationId": "conv_456",
  "message": "I'm looking for a 2-bedroom apartment in Kigali",
  "context": {
    "location": "Kigali",
    "budget": 300000,
    "preferences": ["parking", "security"]
  }
}
```

**Response (200 OK):**
```json
{
  "response": {
    "message": "I found 5 properties matching your criteria...",
    "actions": [
      {
        "type": "show_properties",
        "properties": [
          {
            "id": "prop_001",
            "title": "Modern 2BR Apartment",
            "price": 280000,
            "location": "Kigali, Nyarutarama"
          }
        ]
      }
    ]
  },
  "conversationState": {
    "step": "showing_results",
    "filters": {
      "bedrooms": 2,
      "location": "Kigali"
    }
  }
}
```

---

## Common Patterns

### Pagination

Services use cursor-based pagination:

**Request:**
```http
GET /api/resource?limit=20&cursor=abc123
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "hasMore": true,
    "nextCursor": "def456",
    "total": 150
  }
}
```

### Filtering and Sorting

**Request:**
```http
GET /api/resource?filter[status]=active&sort=-createdAt
```

Parameters:
- `filter[field]=value` - Filter by field
- `sort=field` - Sort ascending
- `sort=-field` - Sort descending

### Rate Limiting

All endpoints implement rate limiting:

**Response Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 75
X-RateLimit-Reset: 2024-03-15T11:00:00Z
```

**Rate Limit Error (429):**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests, please try again later",
  "retryAfter": 60
}
```

### Error Handling

All errors follow consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": {
    "field": "Additional context"
  },
  "timestamp": "2024-03-15T10:30:00Z",
  "requestId": "req_123456"
}
```

### Idempotency

Financial operations require idempotency keys:

```http
POST /wallet/transfer
Idempotency-Key: unique-request-id-12345
```

- Same key returns same response (cached for 24 hours)
- Prevents duplicate transactions
- Use UUIDs or request-specific identifiers

---

## Webhook Events

Services can emit webhook events for async notifications.

### Webhook Payload Format

```json
{
  "event": "transaction.completed",
  "timestamp": "2024-03-15T10:30:00Z",
  "data": {
    "transactionId": "tx_123",
    "amount": 1000.00,
    "status": "completed"
  },
  "signature": "sha256=abc123..."
}
```

### Webhook Verification

Verify webhook signatures before processing:

```typescript
import { verifyHMACSignature } from "@easymo/commons";

const isValid = verifyHMACSignature({
  payload: JSON.stringify(req.body),
  signature: req.headers["x-signature"],
  secret: process.env.WEBHOOK_SECRET,
  algorithm: "sha256",
  encoding: "hex"
});
```

---

## Testing

### Using cURL

```bash
# Health check
curl http://localhost:4400/health

# Transfer with idempotency
curl -X POST http://localhost:4400/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceAccountId": "src_123",
    "destinationAccountId": "dst_456",
    "amount": 100,
    "currency": "USD"
  }'
```

### Using HTTP Client

```http
### Transfer funds
POST http://localhost:4400/wallet/transfer
Authorization: Bearer {{token}}
Idempotency-Key: {{$guid}}
Content-Type: application/json

{
  "sourceAccountId": "src_123",
  "destinationAccountId": "dst_456",
  "amount": 100,
  "currency": "USD"
}
```

---

## Monitoring

### Health Check Endpoints

All services expose `/health`:

```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "redis": true,
    "kafka": true
  },
  "uptime": 86400,
  "timestamp": "2024-03-15T10:30:00Z"
}
```

### Metrics

Services expose Prometheus metrics at `/metrics`:

```
# HELP wallet_transfers_total Total number of wallet transfers
# TYPE wallet_transfers_total counter
wallet_transfers_total{status="success",currency="USD"} 1234

# HELP wallet_transfer_duration_seconds Transfer duration in seconds
# TYPE wallet_transfer_duration_seconds histogram
wallet_transfer_duration_seconds_bucket{le="0.1"} 100
wallet_transfer_duration_seconds_bucket{le="0.5"} 450
```

---

## Support

**Documentation:** https://docs.easymo.com  
**API Issues:** https://github.com/easymo/issues  
**Contact:** support@easymo.com

**Last Updated:** 2024-03-15  
**API Version:** v1.0
