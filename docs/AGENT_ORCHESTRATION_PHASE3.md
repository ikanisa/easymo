# Agent Orchestration Phase 3: Marketplace Agents Implementation

## Overview

Phase 3 extends the autonomous AI agent system to marketplace vendors (pharmacies, quincailleries, shops). Following the same negotiation pattern as Phase 2 drivers, the system can now collect quotes from multiple marketplace vendors within 5-minute windows.

## New Components

### 1. Marketplace Quote Request Handler
**Location:** `supabase/functions/wa-webhook/domains/marketplace/agent_quotes.ts` (400 lines)

Complete WhatsApp integration for marketplace vendors:

**Functions:**
- `sendMarketplaceQuoteRequest()` - Sends formatted requests to vendors
- `parseMarketplaceQuoteResponse()` - Parses prices, availability, delivery times
- `handleMarketplaceQuoteResponse()` - Processes incoming quotes
- `sendMarketplaceQuotePresentationToUser()` - Shows top 3 vendor options

**Message Format:**
```
💊 *New Pharmacy Request - Quote Needed*

📝 *Request:* Paracetamol 500mg, Amoxicillin
📍 *Location:* Kigali City Center
📏 *Distance:* 2.3 km away
🏷️ *Category:* pharmacies

💰 *Please reply with your quote price (RWF)*
📦 *Include availability and delivery time if applicable*
⏱️ *Reply within 5 minutes*

Example: 15,000 RWF - In stock, delivery 30 min
```

**Response Parsing:**
Supports multiple formats:
- "15000"
- "15,000 RWF"
- "RWF 15000"
- "15,000 RWF - In stock, delivery 30 min"
- "20000 RWF 1 hour"

Extracts:
- Price amount
- Availability status (in stock, out of stock, etc.)
- Delivery/preparation time
- Notes

### 2. Extended Agent Negotiation API
**Location:** `supabase/functions/agent-negotiation/index.ts` (enhanced)

Added marketplace vendor discovery:

**New Function:**
```typescript
async function findAndContactMarketplaceVendors(
  sessionId: string,
  request: StartNegotiationRequest
): Promise<void>
```

**Flow:**
1. Determines category from flow type:
   - `nearby_pharmacies` → "pharmacies" category
   - `nearby_quincailleries` → "quincailleries" category
   - `nearby_shops` → "shops" category

2. Calls `nearby_businesses_v2` RPC with:
   - User location
   - Category filter
   - Limit 10 vendors

3. Creates pending quotes for all matched vendors

4. Updates session status:
   - If vendors found: `negotiating`
   - If no vendors: `timeout` with reason

**Feature Flag:**
- Checks `agent.marketplace` for marketplace flows
- Checks `agent.negotiation` for all flows

## Flow Types Supported

### Pharmacies
- **Flow Type:** `nearby_pharmacies`
- **Vendor Type:** `pharmacy`
- **Category:** `pharmacies`
- **Icon:** 💊
- **Use Cases:** Medicine requests, prescription fulfillment

### Quincailleries
- **Flow Type:** `nearby_quincailleries`
- **Vendor Type:** `quincaillerie`
- **Category:** `quincailleries`
- **Icon:** 🛠️
- **Use Cases:** Hardware requests, building supplies, tools

### Shops
- **Flow Type:** `nearby_shops`
- **Vendor Type:** `shop`
- **Category:** `shops`
- **Icon:** 🛍️
- **Use Cases:** General shopping, groceries, essentials

## Database Integration

### Vendor Discovery
```typescript
// Find nearby marketplace vendors
const { data: vendors } = await supabase.rpc(
  "nearby_businesses_v2",
  {
    _lat: location.lat,
    _lng: location.lng,
    _viewer: "",
    _category_slug: "pharmacies",
    _limit: 10,
  }
);

// Create pending quotes for each vendor
for (const vendor of vendors) {
  await supabase.from("agent_quotes").insert({
    session_id: sessionId,
    vendor_id: vendor.id,
    vendor_type: "pharmacy",
    vendor_name: vendor.name,
    vendor_phone: vendor.owner_whatsapp,
    status: "pending",
    offer_data: {
      distance_km: vendor.distance_km,
      category: vendor.category,
      description: requestData.description,
    },
    sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
}
```

### Quote Collection
```typescript
// When vendor responds
const parsed = parseMarketplaceQuoteResponse(text);

await supabase
  .from("agent_quotes")
  .update({
    status: "received",
    price_amount: parsed.priceAmount,
    estimated_time_minutes: parsed.estimatedTimeMinutes,
    notes: parsed.availability || parsed.notes,
    offer_data: {
      priceAmount: parsed.priceAmount,
      availability: parsed.availability,
      estimatedTimeMinutes: parsed.estimatedTimeMinutes,
      notes: parsed.notes,
    },
    received_at: new Date().toISOString(),
  })
  .eq("session_id", sessionId)
  .eq("vendor_phone", vendorPhone);
```

## Complete User Journey

### Pharmacy Example

1. **User Requests Medicine**
   - User: "I need Paracetamol and Amoxicillin"
   - System creates session with `nearby_pharmacies` flow
   - Finds 10 nearby pharmacies

2. **Agent Contacts Pharmacies**
   ```
   💊 *New Pharmacy Request - Quote Needed*
   📝 *Request:* Paracetamol 500mg, Amoxicillin
   📍 *Location:* Kigali City Center
   📏 *Distance:* 2.3 km away
   💰 Reply with your quote price (RWF)
   ⏱️ Reply within 5 minutes
   ```

3. **Pharmacies Respond**
   - Pharmacy A: "15,000 RWF - In stock, delivery 30 min"
   - Pharmacy B: "12,500 RWF - In stock, pickup only"
   - Pharmacy C: "14,000 RWF - Out of stock for Amoxicillin"

4. **System Parses Responses**
   - Extracts prices, availability, delivery times
   - Stores in database
   - Tracks count

5. **User Sees Options** (at 3+ quotes)
   ```
   💊 *Found Pharmacies for Your Request!*
   
   I collected 3 quotes for you:
   
   1️⃣ 12,500 RWF - Pharma Plus
      📦 In stock
      💬 Pickup only
   
   2️⃣ 14,000 RWF - Health Care
      📦 Out of stock for Amoxicillin
      ⏱️ 45 min
   
   3️⃣ 15,000 RWF - MediCenter
      📦 In stock
      ⏱️ 30 min
   
   💡 Reply with the number (1, 2, or 3) to select.
   ```

6. **User Selects**
   - User: "1"
   - System marks Pharmacy A as accepted
   - Other quotes rejected
   - Session completed

### Quincaillerie Example

```
🛠️ *New Quincaillerie Request - Quote Needed*

📝 *Request:* 10kg cement, 20 bricks, wire mesh
📍 *Location:* Nyabugogo
📏 *Distance:* 1.5 km away

💰 Reply with your quote price (RWF)
⏱️ Reply within 5 minutes
```

Response: "45,000 RWF - Available, delivery 1 hour"

### Shop Example

```
🛍️ *New Shop Request - Quote Needed*

📝 *Request:* Rice 5kg, cooking oil 2L, sugar 1kg
📍 *Location:* Kimironko Market
📏 *Distance:* 0.8 km away

💰 Reply with your quote price (RWF)
⏱️ Reply within 5 minutes
```

Response: "18,500 RWF - In stock, ready for pickup"

## Testing

### Manual API Testing

```bash
# 1. Start pharmacy negotiation
curl -X POST http://localhost:54321/functions/v1/agent-negotiation/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "flowType": "nearby_pharmacies",
    "requestData": {
      "pickup": {"lat": -1.9441, "lng": 30.0619},
      "description": "Paracetamol 500mg, Amoxicillin",
      "radiusMeters": 5000
    },
    "windowMinutes": 5
  }'

# 2. Simulate pharmacy response (add quote)
curl -X POST http://localhost:54321/functions/v1/agent-negotiation/quote \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-uuid",
    "vendorPhone": "+250788123456",
    "vendorType": "pharmacy",
    "priceAmount": 15000,
    "estimatedTimeMinutes": 30,
    "notes": "In stock, delivery available"
  }'

# 3. Check session status
curl http://localhost:54321/functions/v1/agent-negotiation/status/session-uuid
```

### Integration Test

```typescript
describe("Marketplace Agent Flows", () => {
  it("should negotiate with pharmacies", async () => {
    const { sessionId } = await startNegotiation({
      userId: testUser.id,
      flowType: "nearby_pharmacies",
      requestData: { 
        pickup: testLocation,
        description: "Medicine request"
      },
    });

    // Simulate 3 pharmacy responses
    const pharmacies = [
      { price: 15000, time: 30, notes: "In stock" },
      { price: 12500, time: 60, notes: "Pickup only" },
      { price: 14000, time: 45, notes: "Partial stock" },
    ];

    for (const pharmacy of pharmacies) {
      await addQuote({
        sessionId,
        vendorPhone: `+25078812${Math.random().toString().slice(2, 8)}`,
        vendorType: "pharmacy",
        priceAmount: pharmacy.price,
        estimatedTimeMinutes: pharmacy.time,
        notes: pharmacy.notes,
      });
    }

    const status = await getSessionStatus(sessionId);
    expect(status.session.status).toBe("presenting");
    expect(status.quotes.received).toBe(3);
  });

  it("should handle quincailleries", async () => {
    const { sessionId } = await startNegotiation({
      userId: testUser.id,
      flowType: "nearby_quincailleries",
      requestData: { 
        pickup: testLocation,
        description: "Building materials"
      },
    });

    // Test implementation
    expect(sessionId).toBeDefined();
  });

  it("should handle shops", async () => {
    const { sessionId } = await startNegotiation({
      userId: testUser.id,
      flowType: "nearby_shops",
      requestData: { 
        pickup: testLocation,
        description: "Groceries"
      },
    });

    // Test implementation
    expect(sessionId).toBeDefined();
  });
});
```

## Deployment

### Environment Variables
```bash
# Enable both feature flags
FEATURE_AGENT_NEGOTIATION=true
FEATURE_AGENT_MARKETPLACE=true
```

### Edge Functions
Already deployed in Phase 2:
```bash
supabase functions deploy agent-negotiation  # Enhanced with marketplace
supabase functions deploy agent-monitor       # Works for all vendor types
```

### Database
Uses existing tables from Phase 1:
- `agent_sessions` (already supports marketplace flow types)
- `agent_quotes` (already supports pharmacy/quincaillerie/shop vendor types)
- `businesses` table (existing marketplace vendors)

### RPC Functions
Uses existing marketplace RPC:
- `nearby_businesses_v2` - Finds vendors by category and location

## Feature Comparison

| Feature | Drivers (Phase 2) | Marketplace (Phase 3) |
|---------|-------------------|----------------------|
| **Discovery** | match_drivers_for_trip_v2 | nearby_businesses_v2 |
| **Vendor Types** | driver | pharmacy, quincaillerie, shop |
| **Request Format** | Pickup/dropoff/distance | Description/category/location |
| **Response Format** | Price + time | Price + availability + time |
| **Quote Ranking** | Price, then time | Price, then time |
| **Feature Flag** | agent.negotiation | agent.negotiation + agent.marketplace |

## Monitoring & Observability

All Phase 2 monitoring applies to marketplace vendors:
- Session creation logged
- Vendor contacts logged
- Quote collection tracked
- Timeouts handled
- Background monitor checks all vendor types

Additional marketplace-specific events:
```typescript
logStructuredEvent("MARKETPLACE_VENDORS_MATCHED", {
  sessionId,
  category: "pharmacies",
  vendorCount: 10,
});

logAgentEvent("AGENT_QUOTE_RECEIVED", {
  sessionId,
  vendorType: "pharmacy",
  priceAmount: 15000,
  availability: "in stock",
});
```

## Performance Considerations

### Query Optimization
- Uses existing `nearby_businesses_v2` RPC (optimized with spatial indexes)
- Category filtering at database level
- Limit 10 vendors per request

### Scalability
- Same as Phase 2 (independent sessions)
- No additional load on background monitor
- Reuses all existing infrastructure

### Cost Optimization
- Single RPC call per negotiation
- Batch quote insertions
- Efficient WhatsApp API usage

## Known Limitations

1. **No Image Processing:** Text-only requests (prescription images planned for future)
2. **Simple Availability:** Keyword-based parsing (not structured inventory)
3. **No Counter-Offers:** Single-round negotiation only
4. **Category Required:** Must map flow type to marketplace category

## Future Enhancements

### Image Processing
- OCR for prescription images
- Extract medicine names automatically
- Hardware list recognition for quincailleries

### Advanced Availability
- Real-time inventory integration
- Stock level indicators
- Alternative product suggestions

### Multi-Round Negotiation
- Agent can counter-offer
- Vendors can update quotes
- Price negotiation rounds

### Additional Categories
- Auto spareparts
- Saloons (beauty services)
- Mobile money agents
- Cars rental/sale
- Houses rental/sale

## Troubleshooting

### No Vendors Found
- Check category spelling
- Verify `nearby_businesses_v2` RPC exists
- Check `businesses` table has active vendors
- Increase radius

### Quotes Not Received
- Verify vendor WhatsApp numbers (E.164 format)
- Check `vendor_phone` in `agent_quotes` table
- Review quote expiry times
- Monitor WhatsApp delivery

### Parse Errors
- Vendor response format not recognized
- Add format to `parseMarketplaceQuoteResponse()`
- Check logs for failed parses

## Documentation

See also:
- Phase 1: `docs/AGENT_ORCHESTRATION_PHASE1.md`
- Phase 2: `docs/AGENT_ORCHESTRATION_PHASE2.md`
- Ground Rules: `docs/GROUND_RULES.md`
- Marketplace Categories: `supabase/functions/wa-webhook/domains/marketplace/categories.ts`
