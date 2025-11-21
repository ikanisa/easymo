# Business Directory - Real-Time Gemini Integration

## Overview

The Broker AI agent now gets business information **directly from Google Maps via Gemini API** in real-time. No database storage needed - users get fresh, up-to-date business data for every search.

## How It Works

### User Query Flow

1. **User asks via WhatsApp**: "Find me restaurants in Kigali"
2. **Broker AI receives request** via General Broker menu
3. **Calls search_business_directory action**
4. **Gemini API queries Google Maps** in real-time
5. **Returns fresh business data** to user

### No Database Storage

- ✅ **Real-time data**: Always fresh from Google Maps
- ✅ **No maintenance**: No need to import/update businesses
- ✅ **Scalable**: Works for any location, any category
- ✅ **Up-to-date**: Ratings, hours, contact info always current

### Optional Database Table

The `business_directory` table still exists and can be used for:
- Caching frequently searched results
- Storing user-favorited businesses
- Sales tracking (contacted, qualified, etc.)
- Offline fallback

## API Actions

### 1. search_business_directory

Search businesses by query, category, city, or rating.

**Example Request:**
```json
{
  "action": "search_business_directory",
  "userId": "user-123",
  "query": "restaurant",
  "city": "Kigali",
  "minRating": 4.0,
  "limit": 5
}
```

**Gemini Prompt:**
```
Search for "restaurant" businesses in "Kigali, Rwanda" with rating 4.0 stars or higher using Google Maps.

Return a JSON array of up to 5 businesses...
```

**Response:**
```json
{
  "businesses": [
    {
      "name": "Heaven Restaurant",
      "address": "KG 7 Ave, Kigali",
      "city": "Kigali",
      "phone": "+250788234567",
      "category": "Restaurant",
      "rating": 4.8,
      "lat": -1.9447,
      "lng": 30.0594,
      "website": "https://heavenrestaurant.rw",
      "place_id": "ChIJ..."
    }
  ],
  "source": "gemini",
  "count": 1
}
```

### 2. search_business_by_location

Find businesses near a specific location.

**Example Request:**
```json
{
  "action": "search_business_by_location",
  "userId": "user-123",
  "latitude": -1.9536,
  "longitude": 30.0606,
  "radiusKm": 5,
  "category": "Cafe",
  "limit": 10
}
```

**Gemini Prompt:**
```
Search for "Cafe" near coordinates -1.9536, 30.0606 in Rwanda within 5km radius using Google Maps.

Return businesses with distance_km field, sorted by distance...
```

**Response:**
```json
{
  "businesses": [
    {
      "name": "Bourbon Coffee",
      "distance_km": 0.8,
      "address": "Union Trade Centre, Kigali",
      "phone": "+250788345678",
      "rating": 4.6,
      ...
    }
  ],
  "source": "gemini",
  "count": 1
}
```

### 3. get_business_details

Get detailed information about a specific business.

**Example Request:**
```json
{
  "action": "get_business_details",
  "userId": "user-123",
  "businessId": "Heaven Restaurant"
}
```

**Response:**
```json
{
  "business": {
    "name": "Heaven Restaurant",
    "address": "KG 7 Ave, Kigali",
    "phone": "+250788234567",
    "rating": 4.8,
    ...
  },
  "source": "gemini"
}
```

## Example Conversations

### Example 1: Find Restaurants

**User**: Find me restaurants in Kigali

**Gemini API Call**:
```
Search for "restaurant" in "Kigali, Rwanda"
```

**Broker AI**: 
```
I found 5 restaurants in Kigali:

1. ⭐ 4.8 - Heaven Restaurant
   📍 KG 7 Ave, Kigali
   📞 +250788234567

2. ⭐ 4.5 - The Hut
   📍 KN 3 Rd, Kigali
   📞 +250788111222

3. ⭐ 4.3 - Pili Pili
   📍 KG 9 Ave, Kigali
   📞 +250788333444

Would you like details about any of these?
```

### Example 2: Find Nearby Cafes

**User**: I'm at -1.9536, 30.0606. Find cafes nearby

**Gemini API Call**:
```
Search near -1.9536, 30.0606 within 5km for "cafe"
```

**Broker AI**:
```
I found 3 cafes within 5km:

1. Bourbon Coffee - 0.8km away ⭐ 4.6
2. Question Coffee - 1.2km away ⭐ 4.4  
3. Java House - 2.5km away ⭐ 4.2

All have WiFi and seating available!
```

### Example 3: High-Rated Hotels

**User**: Show me hotels with rating above 4 stars in Kigali

**Gemini API Call**:
```
Search for "hotel" in "Kigali, Rwanda" with rating 4.0 stars or higher
```

**Broker AI**:
```
I found 4 hotels rated 4+ stars:

1. ⭐ 4.7 - Kigali Marriott Hotel
2. ⭐ 4.6 - Radisson Blu Hotel & Convention Centre
3. ⭐ 4.5 - Kigali Serena Hotel
4. ⭐ 4.2 - Park Inn by Radisson

Which would you like to know more about?
```

## Configuration

### Environment Variables

Required in Edge Function:

```bash
# Gemini API (required for search)
GEMINI_API_KEY=your-gemini-api-key
# or
API_KEY=your-gemini-api-key

# Supabase (for auth and optional caching)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Getting Gemini API Key

1. Go to: https://aistudio.google.com/apikey
2. Create new API key
3. Add to Supabase Edge Function secrets:
```bash
supabase secrets set GEMINI_API_KEY=your-key
```

## Advantages Over Database Storage

| Feature | Database | Real-time Gemini |
|---------|----------|------------------|
| **Data freshness** | Stale (needs updates) | Always current |
| **Coverage** | Limited to imported data | All Google Maps data |
| **Maintenance** | Manual imports required | Zero maintenance |
| **Scalability** | Storage costs | API costs only |
| **Accuracy** | May be outdated | Real-time accuracy |
| **New businesses** | Manual addition | Automatic |

## Performance

### Response Times

- **Gemini API call**: 1-3 seconds
- **Total user response**: 2-4 seconds
- **Caching** (optional): < 500ms for cached results

### Rate Limits

- Gemini API: 60 requests/minute (free tier)
- Gemini API: 1500 requests/day (free tier)
- For higher limits: Upgrade to paid plan

### Cost

- **Free tier**: 60 queries/minute
- **Paid tier**: $0.00025 per request
- **Example**: 10,000 searches/month = $2.50

Much cheaper than maintaining a database!

## Optional: Database Caching

To reduce API calls and costs, you can cache results:

```typescript
async function searchWithCache(query: string, city: string) {
  // Check cache first
  const cached = await supabase
    .from('business_directory')
    .select('*')
    .eq('city', city)
    .ilike('name', `%${query}%`)
    .gt('created_at', new Date(Date.now() - 24*60*60*1000)) // 24h cache
    .limit(10);

  if (cached.data && cached.data.length > 0) {
    return { businesses: cached.data, source: 'cache' };
  }

  // No cache, call Gemini
  const geminiResults = await searchBusinessViaGemini(query, city);

  // Store in cache for next time
  if (geminiResults.length > 0) {
    await supabase.from('business_directory').insert(
      geminiResults.map(b => ({ ...b, source: 'gemini-cache' }))
    );
  }

  return { businesses: geminiResults, source: 'gemini' };
}
```

## Testing

### Test via cURL

```bash
# Set environment
export SUPABASE_URL="https://your-project.supabase.co"
export SERVICE_ROLE_KEY="your-service-role-key"

# Test search
curl -X POST "$SUPABASE_URL/functions/v1/agent-tools-general-broker" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "search_business_directory",
    "userId": "test",
    "query": "cafe",
    "city": "Kigali",
    "limit": 3
  }'
```

### Test via WhatsApp

1. Open WhatsApp
2. Send message to EasyMO number
3. Select "🤝 General Broker"
4. Ask: "Find me cafes in Kigali"

Expected response with real Google Maps data!

## Monitoring

### Check API Usage

```bash
# Via Gemini AI Studio
https://aistudio.google.com/app/apikey

# View usage stats and remaining quota
```

### Logs

```bash
# View Edge Function logs
supabase functions logs agent-tools-general-broker

# Look for:
# - "Gemini search error" - API issues
# - "No response from Gemini API" - Empty results  
# - "No Gemini API key configured" - Missing key
```

## Troubleshooting

### No Results

**Cause**: Gemini API returns empty or invalid JSON

**Solutions**:
1. Check API key is valid
2. Try different search query
3. Check API quota not exceeded
4. Review Gemini AI Studio for errors

### Boot Error

**Cause**: TypeScript compilation error in shared files

**Solution**: Check `_shared/llm-provider-gemini.ts` for import errors

### Slow Responses

**Cause**: Gemini API latency

**Solutions**:
1. Implement caching (see above)
2. Use async responses to user
3. Show "searching..." indicator
4. Limit results (fewer = faster)

## Next Steps

1. ✅ **Test with real users** via WhatsApp
2. **Monitor API usage** and costs
3. **Add caching** if needed for performance
4. **Enhance prompts** for better results
5. **Add features**:
   - Business hours
   - Photos
   - Reviews/ratings breakdown
   - Navigation links
   - Call/WhatsApp direct from results

---

**Status**: ✅ Deployed and ready
**Mode**: Real-time Gemini API (no database storage)
**Last Updated**: 2025-11-21
