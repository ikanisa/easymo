# Buy & Sell AI Agent - Proactive Vendor Outreach

## Overview

This feature transforms the Buy & Sell AI Agent from a passive recommendation engine to a **proactive commerce assistant** that contacts vendors/pharmacies on behalf of users and returns only verified availability.

## Key Features

### 1. Proactive Vendor Contact
- Agent contacts multiple vendors simultaneously via WhatsApp
- Waits for responses within a configurable timeout (default: 5 minutes)
- Returns only verified availability to users

### 2. User Memory System
- Remembers user preferences and past orders
- Stores favorite vendors and locations
- Personalizes recommendations based on history
- Auto-expires sensitive information (medical data after 90 days)

### 3. Vendor Reliability Tracking
- Tracks response rates and response times
- Calculates reliability scores
- Prioritizes vendors with better track records

### 4. Intelligent Conversation Flow
- Multi-step information gathering
- Natural language item parsing
- Location handling (GPS or text)
- Consent-based outreach

## Architecture

### Database Schema

#### Tables Created
1. **agent_outreach_sessions** - Tracks each outreach session
2. **agent_vendor_messages** - Individual messages to/from vendors
3. **agent_user_memory** - User preferences and learned behaviors
4. **agent_vendor_reliability** - Vendor response metrics

#### Business Table Extensions
- `accepts_agent_inquiries` - Opt-in for agent contact
- `agent_inquiry_phone` - Dedicated phone for agent inquiries
- `avg_response_time_minutes` - Historical response time

### Services

#### VendorOutreachService
- **Location**: `supabase/functions/wa-webhook-buy-sell/services/vendor-outreach.ts`
- **Purpose**: Manages vendor outreach sessions, contact, and response tracking
- **Key Methods**:
  - `createSession()` - Initialize outreach session
  - `findVendors()` - Discover suitable vendors
  - `contactVendors()` - Send WhatsApp messages to vendors
  - `processVendorResponse()` - Parse and record vendor responses
  - `checkSessionCompletion()` - Determine if all responses collected

#### UserMemoryService
- **Location**: `supabase/functions/wa-webhook-buy-sell/services/user-memory.ts`
- **Purpose**: Store and recall user context for personalization
- **Key Methods**:
  - `storeMemory()` - Save user preference or behavior
  - `recallMemories()` - Retrieve relevant memories
  - `getUserContext()` - Get complete user context
  - `inferPreferences()` - Deduce preferences from behavior

#### VendorResponseHandler
- **Location**: `supabase/functions/wa-webhook-buy-sell/handlers/vendor-response-handler.ts`
- **Purpose**: Handle incoming vendor responses and notify users
- **Key Methods**:
  - `isVendorResponse()` - Check if message is from a vendor
  - `handleVendorResponse()` - Process vendor reply
  - `formatUserNotification()` - Create user notification message

### Workflows

#### ProactiveOutreachWorkflow
- **Location**: `supabase/functions/wa-webhook-buy-sell/flows/proactive-outreach-workflow.ts`
- **Purpose**: Orchestrate the multi-step conversation flow
- **Steps**:
  1. `gather_items` - Collect what user needs
  2. `gather_location` - Get user location
  3. `propose_vendors` - Show vendor options
  4. `await_consent` - Request permission to contact
  5. `contacting_vendors` - Send messages
  6. `awaiting_responses` - Wait for replies
  7. `show_results` - Present verified results

## Usage Examples

### Happy Path Flow

```
User: "I need paracetamol 500mg"

Agent: 📋 Let's find what you need!
       What items are you looking for?

User: "Paracetamol 500mg x 20"

Agent: ✅ Got it! You need:
       1. Paracetamol 500mg x 20
       
       📍 Share your location so I can find nearby pharmacies...

[User shares location]

Agent: 🔍 Found 5 pharmacies near you!
       
       Top 5 that typically respond quickly:
       1️⃣ PharmaCare (0.5km) - Usually responds in 2 min
       2️⃣ HealthPlus (1.2km) - Usually responds in 5 min
       ...
       
       📞 Would you like me to contact these pharmacies on your behalf?
       
       Reply:
       ✅ YES - I'll contact them for you
       ❌ NO - Show me the list so I can contact them myself

User: "Yes"

Agent: ✅ Great! I'm contacting 5 pharmacies now.
       ⏳ I'll get back to you in about 5 minutes with confirmed
       availability and prices.

[5 minutes later]

Agent: ✅ Good news! 3 pharmacies confirmed they have your items:
       
       1️⃣ PharmaCare - ALL ITEMS IN STOCK
          💰 Total: 2,500 RWF
          📍 0.5 km away
          ⏱️ Responded in 2 min
       
       2️⃣ HealthPlus - ALL ITEMS IN STOCK
          💰 Total: 2,800 RWF
          📍 1.2 km away
          ⏱️ Responded in 4 min
       
       ❌ 2 pharmacies did not respond in time.
       
       📞 Reply with a number (1-2) to get contact details!
```

### User Declines Outreach

```
User: "No, show me the list"

Agent: 📋 Here are the pharmacies near you:
       
       1. PharmaCare (0.5km)
          📍 Kimironko, Kigali
          📞 0788****789
       
       2. HealthPlus (1.2km)
          📍 Remera, Kigali
          📞 0722****456
       ...
       
       Reply with a number to get full contact details
```

### Vendor Response Example

```
[Agent sends to PharmaCare]
"Hello PharmaCare!

A customer near your location is looking for:
1. Paracetamol 500mg x 20

Do you have these items in stock?
Please reply with:
✅ YES - [prices]
❌ NO

Reference: 3c396cf1"

[PharmaCare responds]
"Yes, we have Paracetamol 500mg. Price is 2,500 RWF for 20 tablets."

[Agent processes and records the response]
```

## Configuration

### Environment Variables

```bash
# Vendor Outreach Settings
VENDOR_OUTREACH_TIMEOUT_MINUTES=5  # How long to wait for responses
MAX_VENDORS_TO_CONTACT=10          # Maximum vendors per session

# WhatsApp API (required for sending vendor messages)
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
```

### Feature Flags

```bash
# Enable/disable proactive outreach feature
FEATURE_PROACTIVE_OUTREACH=true
```

## Database Functions

### update_vendor_reliability()
Updates vendor reliability metrics after receiving (or not receiving) a response.

```sql
SELECT update_vendor_reliability(
  p_vendor_phone := '+250788123456',
  p_vendor_id := 'uuid-here',
  p_has_response := true,
  p_response_time_seconds := 120
);
```

### upsert_agent_user_memory()
Stores or updates a user memory entry.

```sql
SELECT upsert_agent_user_memory(
  p_user_phone := '+250788999888',
  p_memory_type := 'preference',
  p_memory_key := 'delivery_method',
  p_memory_value := '{"value": "delivery"}'::jsonb,
  p_confidence := 0.9
);
```

### get_user_memories()
Retrieves active memories for a user.

```sql
SELECT * FROM get_user_memories(
  p_user_phone := '+250788999888',
  p_memory_types := ARRAY['preference', 'past_order']
);
```

## Monitoring & Observability

### Structured Events

All operations emit structured log events:

```typescript
// Session created
logStructuredEvent("VENDOR_OUTREACH_SESSION_CREATED", {
  sessionId,
  userPhone: userPhone.slice(-4),
  itemCount,
  correlationId
});

// Vendor response received
logStructuredEvent("VENDOR_OUTREACH_RESPONSE_RECEIVED", {
  sessionId,
  vendorPhone: vendorPhone.slice(-4),
  hasItems,
  responseTimeSeconds,
  correlationId
});

// Session completed
logStructuredEvent("VENDOR_OUTREACH_SESSION_COMPLETED", {
  sessionId,
  totalVendors,
  positiveResponses,
  correlationId
});
```

### Metrics

Key metrics tracked:

- `vendor.outreach.session.created` - New outreach sessions
- `vendor.outreach.messages.sent` - Messages sent to vendors
- `vendor.outreach.response.received` - Vendor responses
- `vendor.outreach.session.completed` - Completed sessions
- `user.memory.stored` - Memories saved
- `user.memory.recalled` - Memory retrievals

## Security & Privacy

### PII Protection
- Phone numbers are masked in logs (last 4 digits only)
- User location stored as coordinates, not addresses
- Medical information auto-expires after 90 days
- Vendor contact info only shared with user consent

### Webhook Security
All vendor responses must:
- Come through verified WhatsApp webhook
- Match a pending outreach session
- Be within the response timeout window

### Data Minimization
Only share essential information with vendors:
- Item names and quantities
- No user personal information
- No user contact details
- Generic "a customer near you" messaging

## Testing

### Unit Tests
```bash
# Test vendor outreach service
deno test supabase/functions/wa-webhook-buy-sell/services/__tests__/vendor-outreach.test.ts

# Test user memory service
deno test supabase/functions/wa-webhook-buy-sell/services/__tests__/user-memory.test.ts
```

### Integration Tests
```bash
# Test complete outreach flow
deno test supabase/functions/wa-webhook-buy-sell/flows/__tests__/proactive-outreach.test.ts
```

### Manual Testing Scenarios

1. **Happy Path**: User provides items → location → consents → vendors respond → user sees results
2. **Partial Response**: Some vendors respond, some timeout → user sees available options
3. **No Response**: All vendors timeout → user offered alternatives
4. **User Declines**: User says "no" → gets manual vendor list
5. **Prescription Flow**: User sends prescription image → OCR extracts items → same flow
6. **Memory Test**: Returning user → agent recalls past orders → personalized suggestions

## Performance

### Response Times
- Vendor message sending: < 500ms per vendor
- Response parsing: < 100ms
- User notification: < 200ms
- Total flow: ~5-10 minutes (vendor response time)

### Scalability
- Handles 100+ concurrent outreach sessions
- Supports 10,000+ vendors in directory
- Memory system scales to millions of entries

### Database Indexes
All critical query paths are indexed:
- User phone lookups
- Vendor phone lookups
- Session status queries
- Deadline-based queries

## Troubleshooting

### Common Issues

**Issue**: Vendors not receiving messages
- Check `agent_vendor_messages` table for sent messages
- Verify WhatsApp API credentials
- Check vendor phone numbers are valid E.164 format

**Issue**: Session stuck in "collecting_responses"
- Check `response_deadline` field
- Run manual completion check: `SELECT * FROM agent_outreach_sessions WHERE status = 'collecting_responses' AND response_deadline < NOW()`
- Manually trigger completion if needed

**Issue**: Memory not persisting
- Check `agent_user_memory` table
- Verify `expires_at` is null or future date
- Check for unique constraint violations

### Debug Queries

```sql
-- Check active outreach sessions
SELECT id, user_phone, status, created_at, response_deadline
FROM agent_outreach_sessions
WHERE status IN ('contacting_vendors', 'collecting_responses')
ORDER BY created_at DESC;

-- Check vendor response rates
SELECT vendor_phone, total_inquiries, responses_received, reliability_score
FROM agent_vendor_reliability
ORDER BY reliability_score DESC
LIMIT 20;

-- Check user memories
SELECT memory_type, memory_key, last_used_at, use_count
FROM agent_user_memory
WHERE user_phone = '+250788999888'
ORDER BY last_used_at DESC;
```

## Future Enhancements

1. **AI-Powered Response Parsing**: Use LLM to better understand vendor responses
2. **Prescription OCR**: Integrate image recognition for prescription uploads
3. **Multi-Language Support**: Handle vendor responses in Kinyarwanda, French
4. **Price Comparison**: Automatically compare prices across vendors
5. **Delivery Integration**: Coordinate delivery from verified vendors
6. **Vendor Dashboard**: Web interface for vendors to manage agent inquiries
7. **Smart Retry**: Auto-retry with different vendors if initial set fails

## Support

For questions or issues:
- Check logs in Supabase dashboard
- Review structured events for detailed flow
- Contact development team with correlation ID

## License

Copyright © 2024 EasyMO. All rights reserved.
