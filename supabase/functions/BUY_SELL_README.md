# Buy & Sell Agent - Edge Functions

This directory contains the Buy & Sell agent edge functions for vendor outreach and AI-powered sourcing.

## Architecture

The Buy & Sell agent consists of three main edge functions:

### 1. `whatsapp-broadcast` - Vendor Outreach
Sends broadcast messages to vendors using WhatsApp Cloud Business API.

**Features:**
- Opt-in/opt-out compliance (checks `whatsapp_opt_outs` and `vendors.is_opted_in`)
- Regional filtering (excludes UG, KE, NG, ZA countries)
- Database logging to `whatsapp_broadcast_requests` and `whatsapp_broadcast_targets`

**Endpoint:** `POST /whatsapp-broadcast`

**Request:**
```json
{
  "request_id": "unique-id",
  "need_description": "Looking for laptops",
  "user_location_label": "Kigali, Rwanda",
  "target_vendors": [
    {
      "business_name": "Tech Store",
      "business_phone": "+250788123456"
    }
  ]
}
```

### 2. `whatsapp-inbound` - Message Processing
Processes incoming WhatsApp messages from vendors and users.

**Features:**
- Vendor reply detection (HAVE_IT, NO_STOCK, STOP_MESSAGES)
- Voice note transcription using Gemini 2.0 Flash
- User-vendor matching notifications
- Job queuing for async processing

**Endpoint:** `POST /whatsapp-inbound` (webhook)

### 3. `agent-worker` - Background Job Processor
Processes jobs from the queue for intent extraction and sourcing.

**Features:**
- Intent extraction with Gemini (structured JSON schema)
- Sourcing with Google Maps and Google Search grounding
- Candidate vendor management
- Geo-blocking for unsupported markets
- Conversation state management

**Endpoint:** `POST /agent-worker` (internal, triggered by scheduler or manually)

## Database Schema

### Core Tables
- `vendors` - Business vendors with opt-in status
- `whatsapp_broadcast_requests` - Broadcast campaign records
- `whatsapp_broadcast_targets` - Individual message targets
- `whatsapp_opt_outs` - Vendor opt-out list
- `whatsapp_business_replies` - Vendor responses
- `sourcing_requests` - User sourcing requests with intent
- `candidate_vendors` - Found vendors during sourcing
- `jobs` - Background job queue
- `conversations` - Conversation state per user
- `inbound_messages` - Message audit log
- `user_locations` - User location data

### RPC Functions
- `get_next_job()` - Get and lock next pending job
- `increment_positive_response(phone)` - Increment vendor response count

## Shared Utilities

Located in `supabase/functions/_shared/`:

- **buy-sell-gemini.ts** - Gemini AI integration
  - Intent extraction
  - Audio transcription
  - Image analysis
  - Sourcing execution

- **buy-sell-tools.ts** - Tool definitions
  - `save_candidates` function declaration
  - Google Search/Maps configuration

- **buy-sell-types.ts** - TypeScript interfaces
  - WhatsAppMessage
  - ExtractedIntent
  - VendorCandidate
  - ConversationState

- **buy-sell-config.ts** - Configuration utilities
  - African country codes
  - Phone normalization
  - Geo-blocking logic

## Environment Variables

Required:
```bash
# WhatsApp Cloud Business API
WHATSAPP_ACCESS_TOKEN=your-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WA_VERIFY_TOKEN=your-verify-token

# Gemini AI
GEMINI_API_KEY=your-api-key
API_KEY=your-api-key  # Alias

# Supabase
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Optional:
```bash
# WhatsApp Bridge (for frontend)
NEXT_PUBLIC_WHATSAPP_BRIDGE_URL=https://bridge.example.com
WHATSAPP_BRIDGE_API_KEY=your-bridge-key
```

## Important Notes

### ⚠️ Twilio is PROHIBITED
Per `docs/GROUND_RULES.md`, Twilio is strictly prohibited. This implementation uses **WhatsApp Cloud Business API** directly.

### Observability
All functions follow observability requirements:
- Structured logging with correlation IDs
- Metric recording (`recordMetric`)
- PII masking in logs (`maskPhone`)

### Security
- Webhook signature verification for incoming messages
- RLS policies on all tables
- Service role access only for sensitive operations
- Phone number masking in logs

### Geo-blocking
Countries blocked for Buy & Sell: UG, KE, NG, ZA

## Workflow

```
User Message → whatsapp-inbound → Job Queue
                                      ↓
                                 agent-worker
                                      ↓
                              Intent Extraction
                                      ↓
                              Sourcing (Gemini + Google)
                                      ↓
                              Save Candidates
                                      ↓
                              Ask User Confirmation
                                      ↓
                              whatsapp-broadcast
                                      ↓
                              Vendors Receive Message
                                      ↓
                              Vendor Replies → whatsapp-inbound
                                      ↓
                              User Gets Notification
```

## Testing

### Test Broadcast
```bash
curl -X POST https://project.supabase.co/functions/v1/whatsapp-broadcast \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-123",
    "need_description": "Looking for laptops for software development",
    "user_location_label": "Kigali, Rwanda"
  }'
```

### Test Job Processing
```bash
curl -X POST https://project.supabase.co/functions/v1/agent-worker \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## Deployment

Deploy all functions:
```bash
supabase functions deploy whatsapp-broadcast
supabase functions deploy whatsapp-inbound
supabase functions deploy agent-worker
```

Set secrets:
```bash
supabase secrets set WHATSAPP_ACCESS_TOKEN=your-token
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your-phone-id
supabase secrets set GEMINI_API_KEY=your-api-key
```

## Monitoring

Key metrics to monitor:
- `whatsapp.broadcast.sent` - Broadcasts sent
- `vendor.opted_out` - Opt-out events
- `vendor.positive_response` - Positive responses
- `inbound.message.queued` - Messages queued
- `intent.extracted` - Intents extracted
- `sourcing.completed` - Sourcing completed
- `blocked_market.rejection` - Geo-blocked users

## References

- Original source: `ikanisa/Buy-Sell` repository (commit `c087a77`)
- Ground rules: `docs/GROUND_RULES.md`
- Migration: `supabase/migrations/20251214120000_buy_sell_infrastructure.sql`
