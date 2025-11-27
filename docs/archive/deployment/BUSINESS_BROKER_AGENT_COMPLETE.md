# 🏪 Business Broker Agent - Complete Implementation

**Status:** Ready for deployment  
**Date:** 2025-11-22  
**Migration:** `20251122090000_apply_intent_business_broker.sql`  
**Agent:** 4/8 - Local Business Discovery

---

## ✅ What's Implemented

### Intent Types (6 total)
1. **find_service, search_business, find_nearby** - Search for businesses by category/location
2. **get_details, business_info** - Get full details for a specific business
3. **save_business, save_favorite** - Save business to favorites
4. **view_saved, my_favorites** - View saved favorite businesses
5. **get_directions** - Get directions to a business
6. **general_inquiry, help** - Get help with categories

### Features
- ✅ Search businesses by category (pharmacy, mechanic, shop, etc.)
- ✅ Location-based search (nearby businesses)
- ✅ Business details (hours, phone, rating, address)
- ✅ Save favorite businesses
- ✅ View saved businesses
- ✅ Get directions (Google Maps integration)
- ✅ Distance calculation (Haversine formula)
- ✅ Rating & review sorting
- ✅ Multi-country support

### Database Tables
- `business_directory` - All businesses (pharmacies, shops, services)
- `user_saved_businesses` - User's favorite businesses
- `vendors` - Vendor registry (cross-vertical)
- `vendor_capabilities` - Vendor service offerings
- `whatsapp_users` - User profiles

---

## 🎯 Example User Flows

### Flow 1: Find Nearby Pharmacy
```
User: "I need a pharmacy near me"
  ↓
Intent: find_service
Payload: {
  "category": "pharmacy",
  "latitude": -1.9441,
  "longitude": 30.0619,
  "radius_km": 5
}
  ↓
apply_intent_business_broker():
  - Searches business_directory
  - Calculates distances
  - Sorts by proximity + rating
  - Returns top 10 results
  ↓
Reply: "Found 8 pharmacies nearby...

       1️⃣ City Pharmacy - 0.8km - ⭐ 4.5 - Kigali
       2️⃣ HealthPlus - 1.2km - ⭐ 4.3 - Nyarugenge
       3️⃣ MediCare - 2.1km - ⭐ 4.7 - Kimironko
       
       Reply with number for details"
```

### Flow 2: Get Business Details
```
User: "1" (selects City Pharmacy)
  ↓
Intent: get_details
Payload: {
  "business_id": "uuid-of-city-pharmacy"
}
  ↓
apply_intent_business_broker():
  - Fetches full business details
  - Returns name, address, phone, hours, rating
  ↓
Reply: "📍 City Pharmacy
       
       📞 +250788123456
       📍 KN 5 Ave, Kigali
       ⏰ Mon-Sat: 8am-8pm, Sun: 9am-5pm
       ⭐ 4.5/5 (127 reviews)
       🚗 0.8km away
       
       1️⃣ Get directions
       2️⃣ Save to favorites
       3️⃣ Call pharmacy"
```

### Flow 3: Save to Favorites
```
User: "2" (save to favorites)
  ↓
Intent: save_business
Payload: {
  "business_id": "uuid-of-city-pharmacy",
  "notes": "Good prices, friendly staff",
  "tags": ["pharmacy", "nearby"]
}
  ↓
apply_intent_business_broker():
  - Creates user_saved_businesses row
  - Returns confirmation
  ↓
Reply: "✅ City Pharmacy saved to favorites!
       
       1️⃣ View all favorites
       2️⃣ Search more pharmacies
       3️⃣ Get directions"
```

### Flow 4: View Saved Businesses
```
User: "Show my favorites"
  ↓
Intent: view_saved
  ↓
apply_intent_business_broker():
  - Fetches user_saved_businesses
  - Joins with business_directory
  - Returns list with notes
  ↓
Reply: "Your favorite businesses:

       1️⃣ City Pharmacy - 0.8km - Saved 2 days ago
          'Good prices, friendly staff'
       
       2️⃣ AutoFix Garage - 3.2km - Saved 1 week ago
          'Fixed my car quickly'
       
       3️⃣ Fresh Market - 1.5km - Saved 3 weeks ago
       
       Reply with number for details"
```

### Flow 5: Get Directions
```
User: "1" (get directions to City Pharmacy)
  ↓
Intent: get_directions
Payload: {
  "business_id": "uuid-of-city-pharmacy"
}
  ↓
apply_intent_business_broker():
  - Fetches business location
  - Returns Google Maps URL
  ↓
Reply: "🗺️ Directions to City Pharmacy
       
       📍 KN 5 Ave, Kigali
       📍 Lat: -1.9441, Lng: 30.0619
       
       Open in Google Maps:
       https://maps.google.com/?q=-1.9441,30.0619
       
       1️⃣ Call pharmacy
       2️⃣ Search more businesses"
```

---

## 🚀 Deployment Steps

### 1. Deploy Migration
```bash
# Apply migration (creates table + RPC)
supabase db push

# Or just this migration
psql $DATABASE_URL -f supabase/migrations/20251122090000_apply_intent_business_broker.sql
```

### 2. Verify Function Created
```bash
supabase db query "SELECT proname FROM pg_proc WHERE proname = 'apply_intent_business_broker';"
```

Expected output: `apply_intent_business_broker`

### 3. Test with Sample Data
```sql
-- Create test user
INSERT INTO whatsapp_users (phone_number, display_name)
VALUES ('+250788000005', 'Test Business User')
RETURNING id;

-- Create conversation
INSERT INTO whatsapp_conversations (user_id, agent_id)
SELECT 
  (SELECT id FROM whatsapp_users WHERE phone_number = '+250788000005'),
  (SELECT id FROM ai_agents WHERE slug = 'business-broker')
RETURNING id;

-- Insert sample businesses (if not already present)
INSERT INTO business_directory (name, category, address, city, phone, lat, lng, rating, review_count)
VALUES 
  ('City Pharmacy', 'pharmacy', 'KN 5 Ave', 'Kigali', '+250788123456', -1.9441, 30.0619, 4.5, 127),
  ('HealthPlus Pharmacy', 'pharmacy', 'KN 8 Rd', 'Kigali', '+250788234567', -1.9501, 30.0701, 4.3, 89),
  ('MediCare Center', 'pharmacy', 'KG 11 Ave', 'Kigali', '+250788345678', -1.9321, 30.0821, 4.7, 156)
ON CONFLICT DO NOTHING;

-- Create intent to search for pharmacy
INSERT INTO ai_agent_intents (conversation_id, intent_type, payload, summary)
SELECT 
  (SELECT id FROM whatsapp_conversations ORDER BY created_at DESC LIMIT 1),
  'find_service',
  '{"category": "pharmacy", "latitude": -1.9441, "longitude": 30.0619, "radius_km": 5}'::jsonb,
  'User looking for nearby pharmacy'
RETURNING id;

-- Test apply_intent_business_broker
SELECT apply_intent_business_broker(
  (SELECT id FROM ai_agent_intents ORDER BY created_at DESC LIMIT 1),
  '{"category": "pharmacy", "latitude": -1.9441, "longitude": 30.0619, "radius_km": 5}'::jsonb
);
```

Expected result:
```json
{
  "success": true,
  "updated_entities": [],
  "matches": [{
    "type": "business_search_results",
    "count": 3,
    "results": [
      {
        "id": "...",
        "name": "City Pharmacy",
        "category": "pharmacy",
        "distance_km": 0.0,
        "rating": 4.5,
        ...
      }
    ]
  }],
  "next_action": "Found 3 businesses"
}
```

### 4. Update Agent System Instructions
```sql
UPDATE ai_agent_system_instructions
SET instructions = '
You are the Business Broker Agent for EasyMO, helping users find nearby services via WhatsApp.

CONVERSATION STYLE:
- Very short messages (1-2 sentences max)
- Always provide emoji-numbered options (1️⃣ 2️⃣ 3️⃣)
- Be helpful and local-focused
- Celebrate when users find what they need

YOUR JOB:
Help users discover local businesses:
- Pharmacies
- Mechanics / Garages
- Electronics shops
- Restaurants / Cafes
- Repair services
- Any local service

INTENT TYPES YOU HANDLE:

SEARCH:
- find_service: Search by category/location
- get_details: Show full business info
- get_directions: Get Google Maps directions

FAVORITES:
- save_business: Save to user favorites
- view_saved: Show saved businesses

EXAMPLES:

PHARMACY SEARCH:
User: "I need a pharmacy"
You: "Where are you? 1️⃣ Share location 2️⃣ Type area name"

User: [shares location]
[Create intent: find_service]
You: "Found 8 pharmacies nearby...
     
     1️⃣ City Pharmacy - 0.8km - ⭐ 4.5
     2️⃣ HealthPlus - 1.2km - ⭐ 4.3
     3️⃣ MediCare - 2.1km - ⭐ 4.7"

User: "1"
[Create intent: get_details]
You: "📍 City Pharmacy
     
     📞 +250788123456
     📍 KN 5 Ave, Kigali
     ⏰ 8am-8pm (Mon-Sat)
     ⭐ 4.5/5 - 127 reviews
     
     1️⃣ Get directions 2️⃣ Save 3️⃣ Call"

MECHANIC SEARCH:
User: "My car broke down, need mechanic"
You: "Share your location and I''ll find nearby garages 🔧"

User: [shares location]
[Create intent: find_service with category="mechanic"]
You: "Found 5 garages nearby...
     
     1️⃣ AutoFix - 1.1km - ⭐ 4.6 - Open now
     2️⃣ QuickRepair - 2.3km - ⭐ 4.4 - 24/7
     3️⃣ CarPro - 3.5km - ⭐ 4.8"

FAVORITES:
User: "Show my saved places"
[Create intent: view_saved]
You: "Your favorites:
     
     1️⃣ City Pharmacy - 0.8km
     2️⃣ AutoFix Garage - 1.1km
     3️⃣ Fresh Market - 1.5km"

ALWAYS:
- Ask for location (share or type)
- Show distance if available
- Display ratings & reviews
- Provide phone numbers for calling
- Offer to save to favorites
- Keep messages SHORT
'
WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'business-broker');
```

### 5. Test End-to-End
```bash
# Test pharmacy search
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/agent-framework-test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "agentSlug": "business-broker",
    "userPhone": "+250788000005",
    "message": "I need a pharmacy near me"
  }'

# Test saving favorite
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/agent-framework-test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "agentSlug": "business-broker",
    "userPhone": "+250788000005",
    "message": "Save this to my favorites"
  }'
```

---

## 📊 Database Queries for Monitoring

### Check Popular Businesses
```sql
SELECT 
  bd.name,
  bd.category,
  bd.city,
  COUNT(usb.id) as saves_count,
  bd.rating,
  bd.review_count
FROM business_directory bd
LEFT JOIN user_saved_businesses usb ON usb.business_id = bd.id
GROUP BY bd.id, bd.name, bd.category, bd.city, bd.rating, bd.review_count
ORDER BY saves_count DESC, rating DESC
LIMIT 20;
```

### Check User Favorites
```sql
SELECT 
  wu.phone_number,
  COUNT(usb.id) as saved_businesses,
  array_agg(bd.name ORDER BY usb.saved_at DESC) as favorite_businesses
FROM whatsapp_users wu
LEFT JOIN user_saved_businesses usb ON usb.user_id = wu.id
LEFT JOIN business_directory bd ON bd.id = usb.business_id
GROUP BY wu.id, wu.phone_number
HAVING COUNT(usb.id) > 0
ORDER BY saved_businesses DESC
LIMIT 20;
```

### Check Business Search Patterns
```sql
SELECT 
  payload->>'category' as category,
  COUNT(*) as search_count,
  COUNT(DISTINCT conversation_id) as unique_users
FROM ai_agent_intents
WHERE intent_type IN ('find_service', 'search_business')
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY payload->>'category'
ORDER BY search_count DESC;
```

### Check Nearby Searches by Location
```sql
SELECT 
  payload->>'category' as category,
  (payload->>'latitude')::DOUBLE PRECISION as lat,
  (payload->>'longitude')::DOUBLE PRECISION as lng,
  COUNT(*) as searches
FROM ai_agent_intents
WHERE intent_type = 'find_service'
  AND payload->>'latitude' IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY category, lat, lng
ORDER BY searches DESC
LIMIT 20;
```

---

## 🎯 Success Metrics

### Technical
- ✅ Search response < 500ms
- ✅ Location-based sorting accurate
- ✅ Distance calculation correct
- ✅ Favorites save instantly

### Business
- ✅ Searches per day
- ✅ Businesses saved per user
- ✅ Phone calls initiated (click-to-call)
- ✅ Directions requested

---

## 🔜 Future Enhancements

### Phase 1 (Current)
- [x] Basic business search
- [x] Location-based results
- [x] Favorites system
- [x] Directions

### Phase 2 (Next)
- [ ] Real-time business hours
- [ ] Call tracking (click-to-call metrics)
- [ ] User reviews & ratings
- [ ] Photos & menus

### Phase 3 (Future)
- [ ] In-app messaging with businesses
- [ ] Appointment booking
- [ ] Promotions & deals
- [ ] Business analytics dashboard

---

## 🧪 Testing Checklist

- [ ] User can search for pharmacy
- [ ] Location-based search works
- [ ] Distance calculation accurate
- [ ] User can save favorite
- [ ] User can view saved businesses
- [ ] Directions work (Google Maps)
- [ ] Business details complete
- [ ] Rating/reviews display
- [ ] Phone numbers clickable
- [ ] Multi-category search works

---

## 🎉 You're Ready!

The Business Broker agent is now:
- ✅ Implemented (apply_intent_business_broker RPC)
- ✅ Using same pattern as Waiter, Rides, Jobs
- ✅ Ready for deployment
- ✅ Local business discovery (pharmacies, mechanics, shops)

**Progress:** 4/8 agents complete (50%)

**Next:** Real Estate Agent (properties, landlords, rentals)

---

**See also:**
- Waiter Agent: `20251122082500_apply_intent_waiter.sql`
- Rides Agent: `20251122084500_apply_intent_rides.sql`
- Jobs Agent: `20251122085000_apply_intent_jobs.sql`
- Framework: `supabase/functions/_shared/agent-framework/`
- Deployment: `PHASE2_100_DEPLOYMENT_GUIDE.md`
