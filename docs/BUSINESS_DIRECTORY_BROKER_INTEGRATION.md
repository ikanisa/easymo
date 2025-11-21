# Business Directory - Broker AI Agent Integration

## Overview

The Business Directory has been integrated with the General Broker AI Agent, allowing users to search for businesses via WhatsApp chat using natural language.

## Features Added

### 1. Business Directory Search Actions

Three new actions added to `agent-tools-general-broker`:

#### `search_business_directory`
Search businesses by text query, category, city, and rating.

**Parameters:**
- `query` (string, optional): Text to search in business name, category, address
- `category` (string, optional): Filter by business category
- `city` (string, optional): Filter by city
- `minRating` (number, optional): Minimum rating (0-5)
- `limit` (number, optional): Maximum results (default: 10)

**Returns:**
```json
{
  "businesses": [...],
  "source": "database" | "gemini",
  "count": 10
}
```

#### `search_business_by_location`
Find businesses near a geographic point.

**Parameters:**
- `latitude` (number, required): Latitude
- `longitude` (number, required): Longitude
- `radiusKm` (number, optional): Search radius in kilometers (default: 5)
- `category` (string, optional): Filter by category
- `limit` (number, optional): Maximum results (default: 10)

**Returns:**
```json
{
  "businesses": [...],  // Includes distance_km field
  "count": 5
}
```

#### `get_business_details`
Get detailed information about a specific business.

**Parameters:**
- `businessId` (string, required): UUID of the business

**Returns:**
```json
{
  "business": {
    "id": "uuid",
    "name": "Heaven Restaurant",
    "category": "Restaurant",
    "city": "Kigali",
    "address": "KG 7 Ave, Kigali",
    "phone": "+250788234567",
    "rating": 4.8,
    "lat": -1.9447,
    "lng": 30.0594,
    ...
  }
}
```

### 2. Gemini API Fallback

When database search returns no results, the system automatically falls back to Gemini API to search Google Maps for real-time business data.

### 3. WhatsApp Menu Integration

Users can access business search via:
- **WhatsApp Menu**: "🤝 General Broker" (already exists at position 4)
- **Natural Language**: Users can chat and ask for businesses

## How It Works

### User Flow

1. **User Opens WhatsApp**
   - Sends message to EasyMO WhatsApp number

2. **User Selects General Broker**
   - From home menu: "🤝 General Broker"
   - Or types: "Find me a restaurant"

3. **AI Agent Processes Request**
   - Uses Gemini to understand intent
   - Calls appropriate business directory tool
   - Searches database first
   - Falls back to Gemini/Google Maps if needed

4. **User Receives Results**
   - List of businesses with ratings
   - Contact information (phone, address)
   - Location details

5. **User Can Ask Follow-ups**
   - "Show me nearby cafes"
   - "Find pharmacy in Kigali"
   - "I need a hotel with rating above 4"
   - "What's the phone number for Heaven Restaurant?"

## Example Conversations

### Example 1: Simple Category Search

**User**: Find me restaurants in Kigali

**Agent**: 
```
I found 3 restaurants in Kigali:

1. ⭐ 4.8 - Heaven Restaurant
   📍 KG 7 Ave, Kigali
   📞 +250788234567

2. ⭐ 4.6 - Bourbon Coffee
   📍 Union Trade Centre, Kigali
   📞 +250788345678

3. ⭐ 4.5 - Kigali Heights
   📍 KN 4 Ave, Kigali
   📞 +250788123456

Would you like more details about any of these?
```

### Example 2: Location-Based Search

**User**: I'm at -1.9536, 30.0606. Find cafes nearby

**Agent**:
```
I found 2 cafes within 5km of your location:

1. ⭐ 4.6 - Bourbon Coffee
   📍 0.8km away
   📞 +250788345678
   🌐 bourboncoffee.com

2. ⭐ 4.2 - Java House
   📍 2.3km away
   📞 +250788456789

Tap any business for directions.
```

### Example 3: Filtered Search

**User**: Show me hotels with rating above 4 stars

**Agent**:
```
I found 1 hotel with rating 4+ stars:

⭐ 4.5 - Kigali Heights
📍 KN 4 Ave, Kigali
📞 +250788123456
🌐 kigaliheights.com

Category: Hotel
Status: Available for booking

Would you like to contact them?
```

## Testing

### Test via Edge Function

```bash
# Set environment variables
export SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

# Test search_business_directory
curl -X POST \
  "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-tools-general-broker" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "search_business_directory",
    "userId": "test-user",
    "query": "restaurant",
    "city": "Kigali",
    "limit": 5
  }'

# Test search_business_by_location
curl -X POST \
  "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-tools-general-broker" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "search_business_by_location",
    "userId": "test-user",
    "latitude": -1.9536,
    "longitude": 30.0606,
    "radiusKm": 5,
    "category": "Cafe"
  }'

# Test get_business_details
curl -X POST \
  "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-tools-general-broker" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_business_details",
    "userId": "test-user",
    "businessId": "BUSINESS_UUID_HERE"
  }'
```

### Test via SQL

```sql
-- Search restaurants
SELECT name, category, city, rating, phone
FROM business_directory
WHERE category = 'Restaurant'
AND city = 'Kigali'
ORDER BY rating DESC;

-- Search by text
SELECT name, category, city, rating
FROM business_directory
WHERE name ILIKE '%coffee%'
OR category ILIKE '%coffee%';

-- Nearby search (simple version)
SELECT name, category, 
  (6371 * acos(
    cos(radians(-1.9536)) * cos(radians(lat)) *
    cos(radians(lng) - radians(30.0606)) +
    sin(radians(-1.9536)) * sin(radians(lat))
  )) AS distance_km
FROM business_directory
WHERE lat IS NOT NULL AND lng IS NOT NULL
HAVING distance_km <= 5
ORDER BY distance_km;
```

## Deployment

### 1. Deploy Updated Edge Function

```bash
supabase functions deploy agent-tools-general-broker
```

### 2. Verify Deployment

```bash
# Check function logs
supabase functions logs agent-tools-general-broker
```

### 3. Test in Production

Send WhatsApp message:
```
Hi, I'm looking for restaurants in Kigali
```

Expected: AI agent responds with restaurant listings from business_directory table.

## Configuration

### Environment Variables

Required in Edge Function:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `GEMINI_API_KEY` or `API_KEY` - For fallback search (optional)

### Database Permissions

The service role key allows the agent to:
- ✅ Read from `business_directory` (public read policy)
- ✅ Search with filters and full-text search
- ✅ Calculate distances for location-based queries

## Advanced Features

### 1. Gemini Fallback

When local database has no results:
- Automatically queries Google Maps via Gemini
- Caches results for future queries
- Provides real-time business data

### 2. Intelligent Search

The agent understands:
- Natural language queries
- Category synonyms (cafe = coffee shop)
- Location context (near me, in Kigali)
- Quality filters (best rated, top reviewed)

### 3. Multi-Language Support

Can be extended to support:
- Kinyarwanda queries
- French queries  
- Mixed language conversations

## Monitoring

### Check Usage

```sql
-- Total searches today
SELECT COUNT(*)
FROM llm_requests
WHERE function_name = 'agent-tools-general-broker'
AND created_at >= CURRENT_DATE;

-- Popular categories
SELECT 
  metadata->>'category' as category,
  COUNT(*) as searches
FROM llm_requests
WHERE function_name = 'agent-tools-general-broker'
GROUP BY category
ORDER BY searches DESC;
```

### Performance Metrics

- Average search time: < 500ms (database)
- Average search time: < 3s (with Gemini fallback)
- Cache hit rate: Monitor via `source` field

## Troubleshooting

### No Results Returned

**Check:**
1. Database has businesses: `SELECT COUNT(*) FROM business_directory;`
2. Search parameters are correct
3. Gemini API key is set (for fallback)

### Slow Searches

**Optimize:**
1. Ensure indexes are created (already done)
2. Limit results to reasonable number (10-20)
3. Use specific filters (category, city)

### Wrong Results

**Verify:**
1. Business data quality in database
2. Search query matches business names/categories
3. Gemini fallback is working correctly

## Next Steps

1. **Test in WhatsApp**: Send test messages to verify integration
2. **Monitor Usage**: Check logs and metrics
3. **Add More Businesses**: Import real business data
4. **Enhance Agent**: Add more conversational flows
5. **Add Features**: 
   - Save favorite businesses
   - Business ratings/reviews
   - Booking integration
   - Navigation links

---

**Status**: ✅ Ready for testing
**Last Updated**: 2025-11-21
**Integration**: General Broker AI Agent
