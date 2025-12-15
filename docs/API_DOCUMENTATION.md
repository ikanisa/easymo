# EasyMO API Documentation

**Version**: 1.0  
**Last Updated**: 2025-11-27

---

## Overview

EasyMO provides a comprehensive API for managing mobility services, marketplace transactions, and
AI-powered assistance across WhatsApp and web interfaces.

### Base URLs

```
Production:  https://api.easymo.rw
Staging:     https://staging-api.easymo.rw
Development: http://localhost:3000
```

### Authentication

All API requests require authentication via JWT tokens or Supabase session tokens.

```http
Authorization: Bearer <your-token>
```

---

## Core Services

### 1. WhatsApp Webhook Service

**Endpoint**: `/api/webhook/whatsapp`

Handles incoming WhatsApp messages and routes them to appropriate handlers.

#### POST /api/webhook/whatsapp

Receives WhatsApp webhook events from Meta.

**Request Body**:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "PHONE_NUMBER",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "messages": [
              {
                "from": "SENDER_PHONE_NUMBER",
                "id": "MESSAGE_ID",
                "timestamp": "TIMESTAMP",
                "text": {
                  "body": "MESSAGE_CONTENT"
                },
                "type": "text"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Response**:

```json
{
  "success": true,
  "messageId": "msg_123"
}
```

**Status Codes**:

- `200 OK` - Message processed successfully
- `400 Bad Request` - Invalid webhook payload
- `401 Unauthorized` - Invalid verification token
- `500 Internal Server Error` - Processing error

#### GET /api/webhook/whatsapp

Webhook verification endpoint for Meta.

**Query Parameters**:

- `hub.mode` - Should be "subscribe"
- `hub.verify_token` - Verification token
- `hub.challenge` - Challenge string to echo

---

### 2. AI Agent Services

#### POST /api/agents/:agentType/chat

Send a message to a specific AI agent.

**Parameters**:

- `agentType`: `nearby-drivers` | `pharmacy` | `property-rental` | `schedule-trip` | `shops` |
  `quincaillerie`

**Request Body**:

```json
{
  "message": "I need a ride from Kigali to Gisenyi",
  "userId": "user_123",
  "sessionId": "session_456",
  "context": {
    "location": {
      "latitude": -1.9403,
      "longitude": 29.8739
    }
  }
}
```

**Response**:

```json
{
  "success": true,
  "response": "I can help you find a driver. When do you need the ride?",
  "sessionId": "session_456",
  "suggestedActions": [
    {
      "type": "button",
      "label": "Book Now",
      "action": "book_ride"
    }
  ]
}
```

---

### 3. Profile Service

#### GET /api/profiles/:userId

Get user profile information.

**Response**:

```json
{
  "id": "user_123",
  "whatsappE164": "+250781234567",
  "name": "John Doe",
  "email": "john@example.com",
  "locale": "en",
  "createdAt": "2025-01-01T00:00:00Z",
  "metadata": {
    "preferredLanguage": "en"
  }
}
```

#### PATCH /api/profiles/:userId

Update user profile.

**Request Body**:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "locale": "fr"
}
```

---

### 4. Wallet Service

#### GET /api/wallet/:userId/balance

Get user wallet balance.

**Response**:

```json
{
  "balance": 50000,
  "currency": "RWF",
  "pendingTransactions": 2
}
```

#### POST /api/wallet/:userId/transfer

Transfer funds.

**Request Body**:

```json
{
  "toUserId": "user_456",
  "amount": 10000,
  "currency": "RWF",
  "description": "Payment for ride"
}
```

**Response**:

```json
{
  "success": true,
  "transactionId": "txn_789",
  "newBalance": 40000
}
```

---

### 5. Marketplace Service

#### GET /api/marketplace/listings

Get marketplace listings.

**Query Parameters**:

- `category`: Category filter
- `location`: Location filter
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response**:

```json
{
  "listings": [
    {
      "id": "listing_123",
      "title": "2-Bedroom Apartment in Kigali",
      "description": "Modern apartment with great views",
      "price": 200000,
      "currency": "RWF",
      "category": "property",
      "images": ["url1", "url2"],
      "location": {
        "city": "Kigali",
        "district": "Gasabo"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

## Edge Functions

### Admin Functions

Located in `supabase/functions/admin-*`

- `admin-settings` - Manage application settings
- `admin-stats` - Get platform statistics
- `admin-users` - User management
- `admin-trips` - Trip management

### WhatsApp Handler Functions

Located in `supabase/functions/wa-webhook-*`

- `wa-webhook-core` - Main webhook router
- `wa-webhook-mobility` - Mobility services
- `wa-webhook-wallet` - Wallet operations
- `wa-webhook-profile` - Profile and account management
- `wa-webhook-jobs` - Job marketplace
- `wa-webhook-property` - Property listings
- `wa-webhook-buy-sell` - Buy & Sell marketplace

---

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

---

## Rate Limiting

API endpoints are rate-limited to ensure fair usage:

- **Public endpoints**: 100 requests/minute
- **Authenticated endpoints**: 1000 requests/minute
- **Webhook endpoints**: 10,000 requests/minute

Rate limit headers:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

---

## Observability

All API requests include correlation IDs for tracking:

**Request Header**:

```http
X-Correlation-ID: req_abc123xyz
```

**Response Header**:

```http
X-Correlation-ID: req_abc123xyz
```

Use correlation IDs when reporting issues to support.

---

## SDKs and Libraries

### TypeScript/JavaScript

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

// Example: Get user profile
const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
```

---

## Webhooks

EasyMO can send webhooks for various events:

### Event Types

- `user.created` - New user registered
- `transaction.completed` - Payment completed
- `booking.confirmed` - Booking confirmed
- `message.received` - New message received

### Webhook Payload

```json
{
  "event": "transaction.completed",
  "timestamp": "2025-11-27T12:00:00Z",
  "data": {
    "transactionId": "txn_123",
    "amount": 10000,
    "userId": "user_456"
  }
}
```

---

## Support

For API support, contact:

- Email: api-support@easymo.rw
- Documentation: https://docs.easymo.rw
- Status Page: https://status.easymo.rw

---

**Note**: This is a living document. Last updated: 2025-11-27
