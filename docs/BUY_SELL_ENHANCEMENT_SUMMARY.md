# Buy & Sell Agent Enhancements - Integration Summary

## Overview

This document summarizes the Buy & Sell agent enhancements integrated from the Buy-Sell repository, fully adapted to comply with EasyMO's GROUND_RULES.md requirements.

## ⚠️ Critical Adaptation: Twilio → WhatsApp Cloud Business API

The original source code used **Twilio WhatsApp API**, which **violates GROUND_RULES.md**. All code has been adapted to use **WhatsApp Cloud Business API** (Facebook Graph API) instead.

### Changes Made
- ✅ Message sending via Facebook Graph API (`graph.facebook.com`)
- ✅ Webhook verification for WhatsApp Cloud API format
- ✅ Authentication using `WA_TOKEN` instead of Twilio credentials
- ✅ Updated message payload structures
- ✅ Template message support for WhatsApp Cloud API

## New Features

### 1. AI-Powered Intent Extraction (`supabase/functions/_shared/gemini.ts`)

**Purpose**: Extract structured intent from user messages using Gemini AI

**Features**:
- Gemini 2.0 Flash integration with retry logic
- Structured JSON schema output
- Voice note transcription support
- Multimodal content generation
- TTS audio generation
- Confidence scoring

**Key Functions**:
- `generateContent()` - Generate AI responses with tools and grounding
- `extractIntent()` - Extract structured intent from user messages
- `generateAudio()` - Convert text to speech
- `blobToBase64()` / `base64ToBlob()` - Media encoding helpers

**Schema**:
```typescript
{
  need_type: "product" | "service" | "medicine" | "general",
  description: string,
  quantity?: string,
  urgency?: "urgent" | "today" | "this_week" | "flexible",
  location?: string,
  special_requirements?: string[],
  confidence: number (0-1)
}
```

### 2. Agent Tools (`supabase/functions/_shared/buy-sell-tools.ts`)

**Purpose**: Function declarations for Gemini AI agent

**Tools**:
- `save_candidates` - Save vendor candidates from search
- Google Search grounding
- Google Maps grounding

**Configurations**:
- `SOURCING_TOOLS_CONFIG` - Full toolset for vendor discovery
- `SEARCH_TOOL_CONFIG` - Google Search only
- `MAPS_TOOL_CONFIG` - Google Maps only

### 3. Phone & Country Utilities (`supabase/functions/_shared/buy-sell-config.ts`)

**Purpose**: Phone number normalization and country management

**Features**:
- 40+ African country codes mapping
- Phone number normalization to E.164 format
- Country detection from phone numbers
- Geo-blocking for UG, KE, NG, ZA
- Market configuration management

**Key Functions**:
- `normalizePhoneNumber()` - Convert to E.164 format
- `getCountryFromPhone()` - Detect country from phone
- `isBlockedPhone()` - Check if phone is from blocked country
- `isValidPhoneNumber()` - Validate phone format
- `formatPhoneDisplay()` - Format for display

**Examples**:
```typescript
normalizePhoneNumber("0788123456", "250") // "+250788123456"
getCountryFromPhone("+250788123456") // "RW"
isBlockedPhone("+256788123456") // true (Uganda blocked)
```

### 4. WhatsApp Broadcast (`supabase/functions/whatsapp-broadcast/index.ts`)

**Purpose**: Send bulk WhatsApp messages to opted-in vendors

**Features**:
- API key authentication
- Opt-in compliance checking
- Regional filtering (exclude blocked countries)
- Template message support
- Database logging (requests, targets, errors)
- Structured observability

**API Endpoint**: `POST /whatsapp-broadcast`

**Request**:
```json
{
  "requestId": "unique-id",
  "userLocationLabel": "Kigali",
  "needDescription": "Looking for paracetamol tablets",
  "vendorFilter": {
    "tags": ["pharmacy"],
    "minRating": 3.5,
    "maxDistance": 5000
  }
}
```

**Response**:
```json
{
  "success": true,
  "requestId": "unique-id",
  "sentCount": 15,
  "errorCount": 2,
  "totalVendors": 17
}
```

**Authentication**: Header `x-api-key: <WHATSAPP_BRIDGE_API_KEY>`

### 5. WhatsApp Inbound Handler (`supabase/functions/whatsapp-inbound/index.ts`)

**Purpose**: Process incoming WhatsApp messages from vendors and users

**Features**:
- Vendor reply processing (HAVE_IT, NO_STOCK, STOP_MESSAGES)
- Voice note transcription via Gemini
- User-vendor matching notifications
- Job queue insertion for async processing
- Opt-out handling
- Positive response tracking

**Webhook Endpoint**: `POST /whatsapp-inbound`

**Vendor Reply Actions**:
- `HAVE_IT` - Vendor has the product/service
- `NO_STOCK` - Vendor doesn't have it
- `STOP_MESSAGES` - Vendor opts out

**Flow**:
1. Receive webhook from WhatsApp Cloud API
2. Parse message type (text, audio, button, interactive)
3. Transcribe voice notes if needed
4. Determine sender type (vendor or user)
5. Process vendor replies → update database, handle opt-outs
6. Queue user messages → create job for agent-worker

### 6. Agent Worker (`supabase/functions/agent-worker/index.ts`)

**Purpose**: Background job processor with AI-powered sourcing

**Features**:
- Intent extraction with Gemini
- Google Search/Maps grounding for vendor discovery
- Candidate vendor management
- Outreach confirmation flow
- Geo-blocking enforcement
- Conversation state management
- Broadcast triggering

**Job Types**:
- `PROCESS_USER_MESSAGE` - Process user messages

**Conversation Steps**:
1. `COLLECT_INTENT` - Extract user intent
2. `SEARCH_VENDORS` - Find candidate vendors (auto)
3. `CONFIRM_OUTREACH` - Ask user for confirmation
4. `COMPLETED` - Outreach triggered

**Geo-Blocking**:
Users from UG, KE, NG, ZA receive:
> "Sorry, our service is not yet available in your country (XX). We currently don't support: UG, KE, NG, ZA. We're working on expanding to more regions soon!"

**Example Flow**:
1. User: "I need paracetamol tablets"
2. Agent extracts intent, searches vendors
3. Agent: "I found 5 businesses that might help: [list]. Would you like me to contact them?"
4. User: "Yes"
5. Agent triggers broadcast → vendors contacted

### 7. Frontend Service (`admin-app/lib/whatsapp/broadcast.ts`)

**Purpose**: Admin panel service for broadcast management

**Functions**:

**`sendWhatsAppBroadcast(payload, apiKey)`**
- Trigger WhatsApp broadcast campaign
- Returns: `{ success, requestId, sentCount, errorCount }`

**`getBroadcastStatus(requestId, supabase)`**
- Get campaign status and results
- Returns: `{ status, sentCount, totalTargets, targets[] }`

**`getVendorReplies(requestId, supabase)`**
- Fetch vendor responses
- Returns: `[{ businessPhone, action, hasStock, rawBody, createdAt }]`

**Example Usage**:
```typescript
import { sendWhatsAppBroadcast, getBroadcastStatus } from "@/lib/whatsapp/broadcast";

// Trigger broadcast
const result = await sendWhatsAppBroadcast({
  requestId: "campaign-123",
  needDescription: "Looking for paracetamol",
  vendorFilter: { tags: ["pharmacy"] }
}, apiKey);

// Check status
const status = await getBroadcastStatus("campaign-123", supabase);
console.log(`Sent to ${status.sentCount}/${status.totalTargets} vendors`);
```

## Database Schema

### New Tables

**`vendors`**
- Vendor directory with opt-in tracking
- Fields: business_name, phone, lat, lng, is_opted_in, is_onboarded, average_rating, positive_response_count, tags

**`whatsapp_broadcast_requests`**
- Broadcast campaign tracking
- Fields: request_id, user_location_label, need_description, status

**`whatsapp_broadcast_targets`**
- Individual vendor targets for campaigns
- Fields: broadcast_id, business_name, business_phone, country_code, status, twilio_message_sid (actually WhatsApp message ID)

**`whatsapp_opt_outs`**
- Opt-out compliance tracking
- Fields: business_phone, reason

**`whatsapp_business_replies`**
- Vendor reply tracking
- Fields: business_phone, raw_body, action, has_stock, broadcast_target_id

**`sourcing_requests`**
- User sourcing requests
- Fields: user_id, intent_json, status

**`candidate_vendors`**
- Discovered vendor candidates
- Fields: request_id, name, phone, address, place_id, source, is_onboarded, score

**`jobs`**
- Background job queue
- Fields: user_id, type, payload_json, status, error_message

**`conversations`**
- User conversation state
- Fields: user_id, state_json (step, data)

**`inbound_messages`**
- Audit trail of inbound messages
- Fields: user_id, type, text, media_url, wa_message_id

### Helper Functions

**`increment_positive_response(phone)`**
- Increment vendor's positive response count
- Called when vendor replies with HAVE_IT

**`get_next_job()`**
- Get next pending job with atomic lock
- Uses `FOR UPDATE SKIP LOCKED` for concurrency

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (can also use `API_KEY`) |
| `WHATSAPP_BRIDGE_API_KEY` | API key for broadcast authentication |
| `WA_PHONE_ID` | WhatsApp Phone Number ID |
| `WA_TOKEN` | WhatsApp API access token |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for DB access |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `WA_WEBHOOK_VERIFY_TOKEN` | Webhook verification token | None |
| `WA_TEMPLATE_VENDOR_OUTREACH` | WhatsApp template name | `vendor_outreach` |

### Setting Secrets

```bash
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set WHATSAPP_BRIDGE_API_KEY=your-bridge-api-key
supabase secrets set WA_WEBHOOK_VERIFY_TOKEN=your-webhook-token
supabase secrets set WA_TEMPLATE_VENDOR_OUTREACH=vendor_outreach
```

## Testing Checklist

### Automated Tests ✅
- [x] TypeScript linting passes
- [x] No security vulnerabilities detected
- [x] Code review completed

### Manual Testing Required

**WhatsApp Broadcast**:
- [ ] Sends only to opted-in vendors
- [ ] Excludes blocked countries (UG, KE, NG, ZA)
- [ ] Respects opt-out list
- [ ] Records all targets correctly
- [ ] Handles errors gracefully

**Inbound Handler**:
- [ ] Processes HAVE_IT replies correctly
- [ ] Processes NO_STOCK replies correctly
- [ ] Handles STOP_MESSAGES and opts out vendor
- [ ] Transcribes voice notes
- [ ] Queues user messages for processing

**Agent Worker**:
- [ ] Extracts intent with high confidence
- [ ] Finds relevant candidate vendors
- [ ] Presents candidates to user
- [ ] Triggers broadcast on confirmation
- [ ] Blocks users from restricted countries

**Phone Normalization**:
- [ ] Handles local format (0788123456)
- [ ] Handles international format (+250788123456)
- [ ] Handles format without country code (788123456)
- [ ] Detects country correctly

**Conversation Flow**:
- [ ] Maintains state across messages
- [ ] Handles multi-turn conversations
- [ ] Resets on cancellation
- [ ] Completes successfully

## Integration with Existing System

### Existing Components Updated
- `supabase/functions/ENVIRONMENT_VARIABLES.md` - Added new env vars documentation

### Components NOT Modified
- `supabase/functions/_shared/agents/buy-and-sell.ts` - Can optionally be updated to use new utilities
- Existing webhook handlers - Continue to work independently
- Existing database tables - No modifications to existing schema

### Deployment Steps

1. **Apply database migration**:
   ```bash
   supabase db push
   ```

2. **Set environment variables**:
   ```bash
   supabase secrets set GEMINI_API_KEY=...
   supabase secrets set WHATSAPP_BRIDGE_API_KEY=...
   ```

3. **Deploy edge functions**:
   ```bash
   supabase functions deploy whatsapp-broadcast
   supabase functions deploy whatsapp-inbound
   supabase functions deploy agent-worker
   ```

4. **Configure WhatsApp webhook**:
   - Point to: `https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-inbound`
   - Set verify token: `WA_WEBHOOK_VERIFY_TOKEN`

5. **Create WhatsApp template** (via Meta Business Manager):
   - Name: `vendor_outreach` (or custom name)
   - Body: `Hello {{1}}, we have a customer looking for: {{2}}. Can you help?`

6. **Test broadcast** (via admin panel or API):
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-broadcast \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "requestId": "test-1",
       "needDescription": "Test product",
       "vendorFilter": { "tags": ["pharmacy"] }
     }'
   ```

## Observability

All functions include comprehensive structured logging:

### Events Logged
- `GEMINI_CONTENT_GENERATED` - AI generation success
- `GEMINI_GENERATION_ERROR` - AI generation failure
- `VOICE_NOTE_TRANSCRIBED` - Voice transcription success
- `INTENT_EXTRACTED` - Intent extraction complete
- `BROADCAST_STARTED` - Campaign initiated
- `BROADCAST_MESSAGE_SENT` - Message sent to vendor
- `BROADCAST_COMPLETED` - Campaign completed
- `INBOUND_MESSAGE_RECEIVED` - Message received
- `VENDOR_OPTED_OUT` - Vendor opted out
- `VENDOR_POSITIVE_RESPONSE` - Vendor responded positively
- `JOB_QUEUED` - Job added to queue
- `JOB_PROCESSING_STARTED` - Job processing began
- `USER_GEO_BLOCKED` - User from blocked country
- `CANDIDATES_SAVED` - Vendors found and saved
- `OUTREACH_CONFIRMED` - User confirmed outreach
- `BROADCAST_TRIGGERED` - Broadcast API called

### Correlation IDs
All operations include correlation IDs for distributed tracing:
```typescript
const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
```

### Error Tracking
All errors logged with context:
```typescript
await logStructuredEvent("ERROR_TYPE", {
  error: err.message,
  stack: err.stack,
  context: { userId, action },
  correlationId
}, "error");
```

## Security Features

### Authentication
- API key authentication for broadcast endpoint
- Service role key for database access
- Webhook signature verification (WhatsApp Cloud API)

### Compliance
- Opt-in/opt-out enforcement
- Geo-blocking for unsupported markets
- PII masking in logs (phone numbers)

### Rate Limiting
- Leverages existing rate limiting infrastructure
- Can be extended with Upstash Redis

### Data Privacy
- All vendor data encrypted at rest
- Phone numbers normalized and validated
- Opt-out records preserved indefinitely

## Troubleshooting

### Broadcast not sending
1. Check `WHATSAPP_BRIDGE_API_KEY` is set
2. Verify vendors have `is_opted_in = true`
3. Check vendor phones not in blocked countries
4. Verify WhatsApp template exists and is approved

### Voice transcription failing
1. Check `GEMINI_API_KEY` is set
2. Verify audio file is accessible
3. Check audio format is supported (ogg, mp3, mp4)

### Intent extraction low confidence
1. User message too ambiguous
2. Adjust confidence threshold (currently 0.6)
3. Add more context to system instruction

### Geo-blocking not working
1. Verify phone number format is correct
2. Check country code mapping in `buy-sell-config.ts`
3. Review `BLOCKED_COUNTRIES` constant

### Jobs not processing
1. Check `agent-worker` function is deployed
2. Verify function is being called (cron or manual trigger)
3. Check job queue table for pending jobs
4. Review function logs for errors

## Next Steps

### Optional Enhancements
1. Update existing `buy-and-sell.ts` agent to use new utilities
2. Add admin dashboard UI for broadcast management
3. Implement webhook for vendor reply notifications
4. Add analytics dashboard for sourcing metrics
5. Create automated tests for edge functions

### Production Readiness
1. Load test broadcast function
2. Set up monitoring and alerting
3. Configure backup and disaster recovery
4. Document runbook for operations team
5. Train support team on new features

## Summary

This integration adds comprehensive AI-powered vendor sourcing and outreach capabilities to EasyMO's Buy & Sell agent, fully compliant with WhatsApp Cloud Business API and GROUND_RULES.md requirements. The system is ready for manual testing and production deployment.

**Key Achievement**: Successfully adapted Twilio-based code to use WhatsApp Cloud Business API, maintaining all functionality while ensuring compliance with EasyMO's architectural standards.
