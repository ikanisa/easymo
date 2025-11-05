# Agent Orchestration Phase 2: Driver Negotiation Implementation

## Overview

Phase 2 implements the complete driver negotiation flow with real WhatsApp integration, database connectivity, and background monitoring. The system can now autonomously negotiate with multiple drivers, collect quotes within 5-minute windows, and present the best options to users.

## New Components

### 1. Agent Negotiation Edge Function
**Location:** `supabase/functions/agent-negotiation/index.ts`

Complete API for managing negotiation sessions:

**Endpoints:**
- `POST /agent-negotiation/start` - Start new negotiation session
- `POST /agent-negotiation/quote` - Add vendor quote
- `GET /agent-negotiation/status/:sessionId` - Get session status
- `POST /agent-negotiation/complete` - Complete with selected quote

**Key Features:**
- Integrates with `match_drivers_for_trip_v2` RPC
- Creates trips linked to agent sessions
- Finds matching drivers within radius
- Creates pending quotes for all matches
- Automatic status transitions (searching → negotiating → presenting)
- Database-backed (no mocks)

**Usage Example:**
```typescript
// Start negotiation
POST /agent-negotiation/start
{
  "userId": "user-uuid",
  "flowType": "nearby_drivers",
  "requestData": {
    "pickup": { "lat": -1.9441, "lng": 30.0619 },
    "vehicleType": "moto",
    "radiusMeters": 5000
  },
  "windowMinutes": 5
}

// Response
{
  "success": true,
  "sessionId": "session-uuid",
  "status": "negotiating",
  "deadlineAt": "2025-11-05T14:15:00Z",
  "windowMinutes": 5
}
```

### 2. WhatsApp Quote Request Handler
**Location:** `supabase/functions/wa-webhook/domains/mobility/agent_quotes.ts`

Handles sending quote requests to drivers and parsing responses:

**Functions:**
- `sendDriverQuoteRequest()` - Sends formatted request to driver
- `parseDriverQuoteResponse()` - Extracts price/time from text
- `handleDriverQuoteResponse()` - Processes incoming quote
- `sendQuotePresentationToUser()` - Shows top 3 quotes to user

**Message Format:**
```
🚕 *New Ride Request - Quote Needed*

📍 *Pickup:* Kigali Convention Centre
🎯 *Dropoff:* Airport
📏 *Distance:* 12.3 km
🏍️ *Vehicle:* moto

💰 *Please reply with your quote price (RWF)*
⏱️ *Reply within 5 minutes*

Example: 3500 RWF
```

**Response Parsing:**
Supports multiple formats:
- "3500"
- "3500 RWF"
- "RWF 3500"
- "3,500 RWF"
- "3500 RWF 15 min" (with time estimate)

### 3. Agent Monitor Background Worker
**Location:** `supabase/functions/agent-monitor/index.ts`

Periodic background job for session management:

**Endpoints:**
- `POST /agent-monitor/check-expiring` - Check sessions nearing deadline
- `POST /agent-monitor/check-timeouts` - Mark expired sessions as timeout
- `POST /agent-monitor/expire-quotes` - Expire old quotes
- `POST /agent-monitor/run-all` - Run all checks (for cron)

**Monitoring Logic:**

1. **Expiring Sessions (T-1 minute):**
   - 0 quotes: "Still searching, need more time?"
   - 1-2 quotes: "I have 2 quotes, see them now or wait?"
   - 3+ quotes: Already in presenting state

2. **Timed Out Sessions:**
   - Mark as timeout status
   - If quotes exist: Present partial results
   - If no quotes: Notify "no drivers responded"

3. **Expired Quotes:**
   - Change pending → expired if past expires_at
   - Runs every hour

**Cron Setup:**
```bash
# Every minute
curl -X POST https://your-project.supabase.co/functions/v1/agent-monitor/run-all \
  -H "Authorization: Bearer $ANON_KEY"
```

## Database Integration

All orchestrator services now use real database queries:

### Session Creation
```typescript
// Create agent session
const { data: session } = await supabase
  .from("agent_sessions")
  .insert({
    user_id: payload.userId,
    flow_type: payload.flowType,
    status: "searching",
    request_data: payload.requestData,
    started_at: now.toISOString(),
    deadline_at: deadline.toISOString(),
  })
  .select()
  .single();

// Create trip linked to session
const { data: trip } = await supabase
  .from("trips")
  .insert({
    creator_user_id: request.userId,
    role: "passenger",
    vehicle_type: requestData.vehicleType,
    pickup_lat: requestData.pickup.lat,
    pickup_lng: requestData.pickup.lng,
    pickup: `SRID=4326;POINT(${lng} ${lat})`,
    agent_session_id: sessionId,
    status: "open",
  })
  .select("id")
  .single();
```

### Driver Matching
```typescript
// Call existing RPC function
const { data: matches } = await supabase.rpc(
  "match_drivers_for_trip_v2",
  {
    _trip_id: trip.id,
    _limit: 10,
    _radius_m: 5000,
    _window_days: 30,
  }
);

// Create pending quotes for all matches
for (const match of matches) {
  await supabase.from("agent_quotes").insert({
    session_id: sessionId,
    vendor_id: match.creator_user_id,
    vendor_type: "driver",
    vendor_phone: match.whatsapp_e164,
    status: "pending",
    offer_data: {
      distance_km: match.distance_km,
      ref_code: match.ref_code,
    },
    sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
}
```

### Quote Collection
```typescript
// Add/update quote when driver responds
const { data: quote } = await supabase
  .from("agent_quotes")
  .upsert({
    session_id: sessionId,
    vendor_phone: driverPhone,
    status: "received",
    price_amount: 3500,
    estimated_time_minutes: 15,
    received_at: new Date().toISOString(),
  }, {
    onConflict: "session_id,vendor_phone",
  })
  .select()
  .single();

// Check if we have enough quotes (3+)
const { count } = await supabase
  .from("agent_quotes")
  .select("*", { count: "exact", head: true })
  .eq("session_id", sessionId)
  .eq("status", "received");

if (count >= 3) {
  await supabase
    .from("agent_sessions")
    .update({ status: "presenting" })
    .eq("id", sessionId);
}
```

### Quote Ranking
```typescript
// Get best quotes sorted by price, then time
const { data: quotes } = await supabase
  .from("agent_quotes")
  .select("*")
  .eq("session_id", sessionId)
  .eq("status", "received")
  .order("price_amount", { ascending: true, nullsLast: true })
  .limit(3);
```

## WhatsApp Integration Flow

### Complete User Journey

1. **User Requests Ride**
   - User shares location in WhatsApp
   - System creates negotiation session
   - Finds nearby drivers (10 max)

2. **Agent Contacts Drivers**
   - Sends quote request to each driver
   - Creates pending quotes in database
   - Sets 10-minute expiry per quote

3. **Drivers Respond**
   - Driver replies with price (e.g., "3500 RWF")
   - System parses response
   - Updates quote status to "received"
   - Tracks count of received quotes

4. **Quote Collection**
   - When 3+ quotes received → Move to presenting
   - At T-1 minute → "Need more time?" prompt
   - At deadline → Timeout with partial results

5. **User Sees Options**
   ```
   🎯 Found Drivers for Your Trip!
   
   I collected 3 quotes for you:
   
   1️⃣ 3500 RWF - 15 min
   2️⃣ 3800 RWF - 10 min
   3️⃣ 4000 RWF - 12 min
   
   💡 Reply with the number (1, 2, or 3) to select.
   ```

6. **User Selects**
   - User replies "1"
   - System marks quote as accepted
   - Other quotes rejected
   - Session marked completed
   - Trip updated with selected driver

## Testing

### Manual Testing

```bash
# 1. Start negotiation
curl -X POST http://localhost:54321/functions/v1/agent-negotiation/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "flowType": "nearby_drivers",
    "requestData": {
      "pickup": {"lat": -1.9441, "lng": 30.0619},
      "vehicleType": "moto",
      "radiusMeters": 5000
    },
    "windowMinutes": 5
  }'

# 2. Simulate driver response (add quote)
curl -X POST http://localhost:54321/functions/v1/agent-negotiation/quote \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-uuid",
    "vendorPhone": "+250788123456",
    "vendorType": "driver",
    "priceAmount": 3500,
    "estimatedTimeMinutes": 15
  }'

# 3. Check session status
curl http://localhost:54321/functions/v1/agent-negotiation/status/session-uuid

# 4. Run monitor (check for expiring/timeouts)
curl -X POST http://localhost:54321/functions/v1/agent-monitor/run-all
```

### Integration Test

```typescript
// Test complete flow
describe("Driver Negotiation Flow", () => {
  it("should complete negotiation with 3 drivers", async () => {
    // Start negotiation
    const { sessionId } = await startNegotiation({
      userId: testUser.id,
      flowType: "nearby_drivers",
      requestData: { pickup: testLocation },
    });

    // Simulate 3 driver responses
    for (let i = 0; i < 3; i++) {
      await addQuote({
        sessionId,
        vendorPhone: `+25078812345${i}`,
        priceAmount: 3000 + i * 500,
        estimatedTimeMinutes: 15 + i * 5,
      });
    }

    // Check session moved to presenting
    const status = await getSessionStatus(sessionId);
    expect(status.session.status).toBe("presenting");
    expect(status.quotes.received).toBe(3);

    // Complete with best quote
    await completeNegotiation(sessionId, status.quotes.best[0].id);

    // Verify completion
    const final = await getSessionStatus(sessionId);
    expect(final.session.status).toBe("completed");
  });
});
```

## Deployment

### Environment Variables
Already configured in Phase 1:
```bash
FEATURE_AGENT_NEGOTIATION=true  # Enable for production
```

### Supabase Functions
```bash
# Deploy edge functions
supabase functions deploy agent-negotiation
supabase functions deploy agent-monitor

# Set up secrets
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

### Cron Job Setup
```sql
-- Using pg_cron extension
SELECT cron.schedule(
  'agent-monitor-job',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/agent-monitor/run-all',
    headers := '{"Authorization": "Bearer ' || current_setting('app.anon_key') || '"}'::jsonb
  );
  $$
);
```

## Performance Considerations

### Query Optimization
- Indexes on agent_sessions (status, deadline_at)
- Indexes on agent_quotes (session_id, status)
- Limit 10 drivers per negotiation
- Cache-friendly RPC calls

### Scalability
- Each session independent (no locking)
- Background monitor runs every minute
- Expired quotes cleaned up hourly
- Session auto-timeout after deadline

### Cost Optimization
- Single RPC call per negotiation
- Batch quote insertions
- Minimal WhatsApp API calls
- Efficient status checks

## Next Steps (Phase 3)

### Marketplace Agents
- Pharmacy negotiation (similar pattern)
- Quincaillerie negotiation
- Shop negotiation
- Image processing for prescriptions/lists

### Advanced Features
- Counter-offers from agents
- Price negotiation rounds
- Travel pattern learning
- Predictive pre-matching

### UI Enhancements
- Real-time quote updates
- Map view of drivers
- Price comparison graphs
- Driver ratings integration

## Monitoring

### Key Metrics
- Sessions started per day
- Average quotes per session
- Completion rate (completed / started)
- Timeout rate
- Average response time
- User satisfaction

### Alerts
- High timeout rate (>30%)
- Low driver response rate (<50%)
- System errors in negotiation
- Background monitor failures

## Troubleshooting

### Common Issues

**No drivers found:**
- Check radius (try 10km)
- Verify driver_status table has recent data
- Check vehicle_type matches

**Quotes not received:**
- Verify WhatsApp delivery
- Check vendor_phone format (E.164)
- Review quote expiry times

**Timeouts:**
- Monitor background worker logs
- Check cron job running
- Verify deadline_at calculations

**Status stuck:**
- Manual status update via SQL
- Check for database locks
- Review transaction logs

## Documentation Updates

See also:
- Phase 1 Foundation: `docs/AGENT_ORCHESTRATION_PHASE1.md`
- Ground Rules: `docs/GROUND_RULES.md`
- WhatsApp Integration: `docs/WHATSAPP_FLOWS.md`
