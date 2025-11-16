# Business Claiming Flow - OpenAI Semantic Search

**Date:** 2025-11-14  
**Status:** ✅ IMPLEMENTED

## 🎯 Overview

Smart business claiming system that allows users to find and claim their businesses from the
existing database using OpenAI-powered semantic search.

## 📋 User Flow

```
1. User taps "Profile" from main menu
2. User taps "My Businesses"
3. User taps "Add Business" button
4. System: "Type the name of your business as it appears on Google Maps"
5. User types: e.g., "Bourbon Coffee Kigali"
6. System: "🔍 Searching for businesses..." (OpenAI semantic search)
7. System shows list of top 9 matching businesses
8. User selects their business
9. System claims business:
   - Updates business_owners table
   - Adds user's WhatsApp to business_whatsapp_numbers
   - Updates owner_id in business table
   - Adds to profile_assets for tracking
10. System: "🎉 Success! You now own [Business Name]"
11. User can now manage the business
```

## 🤖 OpenAI Semantic Search

### Three-Stage Search Process:

#### Stage 1: Query Understanding

```typescript
// OpenAI extracts search intent and keywords
Input: "Bourbon Coffee Kigali"
Output: {
  keywords: ["Bourbon", "Coffee", "Kigali"],
  category_hints: ["cafe", "restaurant"],
  location_hints: ["Kigali"]
}
```

#### Stage 2: Database Query

```sql
-- Smart query with extracted terms
SELECT id, name, category, address
FROM business
WHERE name ILIKE '%Bourbon%'
   OR name ILIKE '%Coffee%'
   OR category ILIKE '%cafe%'
LIMIT 20;
```

#### Stage 3: AI Ranking

```typescript
// OpenAI ranks results by relevance
Input: {
  query: "Bourbon Coffee Kigali",
  businesses: [list of 20 businesses]
}
Output: {
  ranked_ids: ["id1", "id2", "id3", ...] // Ordered by relevance
}
```

### Fallback Mechanism:

- If OpenAI API unavailable → Simple ILIKE search
- If no results → Suggest alternative spellings
- If search fails → Graceful error handling

## 📊 Database Schema

### Tables Used:

#### 1. `business` (Main Table)

```sql
- id (UUID)
- name (TEXT)
- category (TEXT)
- address (TEXT)
- owner_id (UUID) - Legacy field
- google_maps_url (TEXT)
- latitude (NUMERIC)
- longitude (NUMERIC)
```

#### 2. `business_owners` (Ownership Tracking)

```sql
- id (UUID)
- business_id (UUID) → business.id
- owner_id (UUID) → profiles.id
- role (TEXT) - 'owner', 'manager', etc.
- is_primary (BOOLEAN)
- created_at (TIMESTAMPTZ)
```

#### 3. `business_whatsapp_numbers` (Multiple Numbers)

```sql
- id (UUID)
- business_id (UUID) → business.id
- whatsapp_number (TEXT)
- is_primary (BOOLEAN)
- is_active (BOOLEAN)
- added_by (UUID) → profiles.id
- created_at (TIMESTAMPTZ)
```

#### 4. `profile_assets` (User Asset Tracking)

```sql
- profile_id (UUID)
- kind (TEXT) - 'business', 'vehicle', 'property'
- reference_id (UUID) - Points to business.id
```

## 🔧 Implementation Details

### Files Created/Modified:

| File                         | Type     | Purpose                                 |
| ---------------------------- | -------- | --------------------------------------- |
| `domains/business/claim.ts`  | NEW      | OpenAI semantic search & claiming logic |
| `domains/profile/index.ts`   | MODIFIED | Integrated business claim flow          |
| `router/text.ts`             | MODIFIED | Handle business name input              |
| `router/interactive_list.ts` | MODIFIED | Handle business selection               |
| `i18n/messages/en.json`      | MODIFIED | Translation keys                        |

### Key Functions:

#### `startBusinessClaim(ctx)`

- Initiates claiming flow
- Sets state to `business_claim`
- Prompts user for business name

#### `handleBusinessNameSearch(ctx, businessName)`

- Validates input (min 2 characters)
- Calls OpenAI semantic search
- Shows top 9 results in list view
- Handles no results gracefully

#### `searchBusinessesSemantic(ctx, query)`

- **Stage 1:** Generate embedding for query
- **Stage 2:** Extract keywords & intent with GPT-4o-mini
- **Stage 3:** Query database with smart filters
- **Stage 4:** Rank results with AI
- **Fallback:** Simple ILIKE search if AI fails

#### `handleBusinessClaim(ctx, state, selectionId)`

- Validates business not already claimed
- Claims business (4-step process)
- Notifies user of success
- Clears state

#### `claimBusiness(ctx, businessId)`

1. Insert into `business_owners` table
2. Add to `business_whatsapp_numbers` table
3. Update `business.owner_id` (legacy)
4. Add to `profile_assets` for tracking

## 🎨 UI/UX Features

### Smart Search Suggestions:

```
No results? Try:
• Different spelling
• Shorter name
• Common name instead of brand name
```

### Result Display:

```
🏢 Bourbon Coffee Kigali City
   Cafe • Kigali City Center • 500m away

🏢 Bourbon Coffee Kimihurura
   Cafe • Kimihurura • 2.5km away
```

### Success Message:

```
🎉 Success!

You now own Bourbon Coffee Kigali

You can:
• Manage business details
• Add more WhatsApp numbers
• Update business info
• View customer inquiries
```

## 🔒 Security & Validation

### Ownership Checks:

1. **Already Owned by User:**
   - Check `business_owners` for existing claim
   - Show "You already own this business"

2. **Already Owned by Someone Else:**
   - Check for other owners
   - Show "Already claimed" message
   - Suggest contacting support

3. **Multiple WhatsApp Numbers:**
   - Business can have multiple numbers
   - Each number tracked in `business_whatsapp_numbers`
   - Primary number flagged

## 📈 Metrics & Logging

### Events Logged:

```typescript
- BUSINESS_CLAIM_STARTED
- BUSINESS_CLAIM_SEARCH_RESULTS
- BUSINESS_SEARCH_SEMANTIC (with method)
- BUSINESS_SEARCH_SIMPLE (fallback)
- BUSINESS_CLAIMED (successful claim)
```

### Search Metrics:

```typescript
{
  query: "user search term",
  results_count: 9,
  method: "openai_semantic" | "simple_ilike"
}
```

## 🎯 Business Value

### For Business Owners:

- ✅ Easy discovery of their businesses in system
- ✅ Claim ownership with one tap
- ✅ Manage business information
- ✅ Add multiple contact numbers
- ✅ Track customer inquiries

### For Users:

- ✅ Find businesses easily
- ✅ Smart search understands typos
- ✅ See relevant results
- ✅ Quick claiming process

### For Platform:

- ✅ Accurate business ownership
- ✅ Better data quality
- ✅ Multiple contact channels
- ✅ Owner engagement

## 🧪 Testing

### Test Cases:

#### 1. Exact Match:

```
Input: "Bourbon Coffee"
Expected: Bourbon Coffee locations shown first
```

#### 2. Partial Match:

```
Input: "Bourbon"
Expected: All Bourbon-related businesses
```

#### 3. Typo Handling:

```
Input: "Borbon Coffe"
Expected: Still shows Bourbon Coffee (AI understands)
```

#### 4. Category Search:

```
Input: "Coffee shop Kigali"
Expected: Coffee shops in Kigali area
```

#### 5. No Results:

```
Input: "XYZ123NonExistent"
Expected: Helpful suggestions shown
```

#### 6. Already Claimed:

```
Action: Try to claim same business twice
Expected: "You already own this business"
```

## 🚀 Deployment

### Environment Variables Required:

```bash
OPENAI_API_KEY=sk-...  # For semantic search
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Deploy Command:

```bash
supabase functions deploy wa-webhook --no-verify-jwt
```

### Verification:

```bash
# Test flow
1. Send "Profile" to bot
2. Select "My Businesses"
3. Tap "Add Business"
4. Type a business name
5. Verify search results appear
6. Select a business
7. Confirm claimed successfully
```

## 📊 Database Queries for Monitoring

### Check Claimed Businesses:

```sql
SELECT
  b.name,
  b.category,
  bo.role,
  bo.created_at,
  bw.whatsapp_number
FROM business b
JOIN business_owners bo ON bo.business_id = b.id
LEFT JOIN business_whatsapp_numbers bw ON bw.business_id = b.id
WHERE bo.owner_id = '[user_profile_id]'
ORDER BY bo.created_at DESC;
```

### Search Performance:

```sql
-- Check recent searches
SELECT
  payload->>'query' as search_query,
  payload->>'results_count' as results,
  payload->>'method' as search_method,
  created_at
FROM event_logs
WHERE event_name IN ('BUSINESS_SEARCH_SEMANTIC', 'BUSINESS_SEARCH_SIMPLE')
ORDER BY created_at DESC
LIMIT 20;
```

### Claim Rate:

```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as claims
FROM business_owners
WHERE created_at > now() - interval '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## 🔄 Future Enhancements

### Phase 2 Features:

- [ ] Image-based business search (upload photo)
- [ ] Location-based search (find nearby businesses)
- [ ] Bulk business claiming
- [ ] Business verification (documents)
- [ ] Transfer ownership
- [ ] Co-ownership support
- [ ] Business analytics dashboard

## ✅ Verification Checklist

- [x] OpenAI semantic search implemented
- [x] Fallback to simple search works
- [x] Business claiming logic complete
- [x] Multiple WhatsApp numbers supported
- [x] Ownership validation works
- [x] Translation keys added
- [x] Router integration complete
- [x] Error handling comprehensive
- [x] Logging & metrics added
- [x] Documentation complete

---

## 📞 Summary

**Smart Business Claiming Flow:**

- 🤖 OpenAI-powered semantic search
- 🎯 Top 9 relevant results
- ⚡ One-tap claiming
- 📞 Multiple WhatsApp numbers
- 🔒 Ownership validation
- 📊 Full audit trail

**Result:** Business owners can easily find and claim their businesses with intelligent search! 🚀
