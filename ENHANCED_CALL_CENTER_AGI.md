# Enhanced Call Center AI Agent

Complete implementation of guardrails, mandatory location collection, structured intent recording, and automatic WhatsApp notifications.

## 📋 Overview

The Enhanced Call Center AI Agent now includes:

1. **🛡️ Strict Guardrails** - Only discusses EasyMO services
2. **📍 Mandatory Location** - Enforces location collection for all requests
3. **📊 Structured Intents** - Records complete user requests
4. **🔔 Auto Notifications** - Sends WhatsApp messages when matches are found
5. **🎯 Intent Matching** - Background processing to find relevant listings

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Voice Call (WhatsApp/Phone)                   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Call Center AGI (wa-agent-call-center)              │
│  • Guardrails enforcement                                        │
│  • Location collection                                           │
│  • Intent validation                                             │
│  • record_user_intent tool                                       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     user_intents (Database)                      │
│  • Structured intent storage                                     │
│  • Required fields per intent type                               │
│  • Auto-queued for processing                                    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Intent Processing (Every 5 minutes)                 │
│  • Finds matching listings                                       │
│  • Stores matches in intent_matches                              │
│  • Sends WhatsApp notifications                                  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WhatsApp Notification                         │
│  • "We found 3 properties matching your search..."               │
│  • Formatted match details                                       │
│  • Reply options for more info                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 🛡️ Guardrails

The agent will ONLY discuss EasyMO services:

### ✅ Allowed Topics
- Rides & Delivery
- Real Estate
- Jobs & Employment
- Farmers Market
- Marketplace (Buy/Sell)
- Insurance
- Legal/Notary
- Pharmacy
- Wallet & Tokens
- MoMo Payments

### ❌ Blocked Topics
- Politics
- Religion
- Personal opinions
- General knowledge (weather, news, sports)
- Entertainment (jokes, stories, games)
- Technical support for non-EasyMO products

### Example Redirects

```
User: "What's the weather today?"
Agent: "I can only help with EasyMO services. Let me know if you need help 
        with transportation, housing, jobs, or our other services."

User: "Tell me a joke"
Agent: "I understand, but I'm specifically designed to help with EasyMO 
        services. Is there something I can help you with today?"
```

## 📍 Mandatory Location Collection

For ALL service requests, the agent will collect location before proceeding.

### Recognized Locations

**Rwanda:**
- Cities: Kigali, Musanze, Huye
- Neighborhoods: Kimironko, Nyamirambo, Remera, Gisozi, Kacyiru, Gasabo, Nyarugenge

**Malta:**
- Cities: Valletta, Sliema, St. Julian's, Birkirkara, Mosta, Qormi, Zabbar

### Location Flow

```
User: "I need a house"
Agent: "I can help you find a house! Are you looking to rent or buy?"
User: "Rent"
Agent: "Great! Which area are you looking in?"  👈 MANDATORY
User: "Kimironko"
Agent: "How many bedrooms do you need?"
...
```

## 📋 Intent Collection Requirements

Each intent type has specific required fields:

### 🏠 Property Seeker
| Field | Required | Example |
|-------|----------|---------|
| location | ✅ | "Kimironko" |
| listing_type | ✅ | "rent" or "buy" |
| bedrooms | ✅ | 2 |
| max_budget | ✅ | 300000 |
| amenities | ❌ | ["parking", "furnished"] |

### 👔 Job Seeker
| Field | Required | Example |
|-------|----------|---------|
| location | ✅ | "Kigali" |
| job_type | ✅ | "full_time" |
| skills | ✅ | ["driving", "customer service"] |
| salary_expectation | ❌ | 200000 |

### 👔 Job Poster
| Field | Required | Example |
|-------|----------|---------|
| location | ✅ | "Remera" |
| job_title | ✅ | "Driver" |
| job_type | ✅ | "full_time" |
| pay_range | ✅ | "150,000 - 200,000 RWF" |
| description | ✅ | "Experience with deliveries" |

### 🌾 Farmer Seller
| Field | Required | Example |
|-------|----------|---------|
| location | ✅ | "Musanze" |
| product_type | ✅ | "tomatoes" |
| quantity | ✅ | 500 |
| unit | ✅ | "kg" |
| available_date | ✅ | "2025-12-10" |
| price_per_unit | ❌ | 800 |

### 🌾 Farmer Buyer
| Field | Required | Example |
|-------|----------|---------|
| location | ✅ | "Kigali" |
| product_type | ✅ | "potatoes" |
| quantity_needed | ✅ | 1000 |
| delivery_location | ✅ | "Kimironko" |
| max_price | ❌ | 500 |

## 🔔 WhatsApp Notifications

When matches are found, users receive formatted WhatsApp messages:

### Example: Property Matches

```
🏠 *Great news!* We found properties matching your search in Kimironko:

1️⃣ *2BR Rental in Kimironko*
   📍 Near Simba Supermarket
   💰 280,000 RWF/month

2️⃣ *2BR Apartment*
   📍 Kimironko Heights
   💰 300,000 RWF/month

3️⃣ *2BR House*
   📍 Kimironko Center
   💰 250,000 RWF/month

💬 Reply "more" for additional options or "details [number]" for more info.
```

### Example: Job Matches

```
👔 *Good news!* We found jobs that match what you're looking for:

1️⃣ *Driver* at Express Delivery
   📍 Kigali
   💰 180,000 RWF/month
   ⏰ Full-time

2️⃣ *Delivery Driver* at QuickShip
   📍 Remera
   💰 150,000 RWF/month
   ⏰ Full-time

💬 Reply "more" for additional options or "details [number]" for more info.
```

## 🗄️ Database Schema

### user_intents

```sql
CREATE TABLE user_intents (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(user_id),
  phone_number TEXT NOT NULL,
  
  intent_type TEXT NOT NULL,  -- 'property_seeker', 'job_seeker', etc.
  location_text TEXT NOT NULL,  -- MANDATORY
  location_coords JSONB,  -- {lat, lng}
  
  details JSONB NOT NULL,  -- Intent-specific fields
  urgency TEXT DEFAULT 'flexible',  -- 'immediate', 'within_week', 'flexible'
  language TEXT DEFAULT 'en',
  
  status TEXT DEFAULT 'pending_match',  -- → 'matching' → 'matched' → 'notified'
  source TEXT DEFAULT 'voice_call',
  call_id TEXT,
  
  matched_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### intent_processing_queue

```sql
CREATE TABLE intent_processing_queue (
  id UUID PRIMARY KEY,
  intent_id UUID REFERENCES user_intents(id),
  intent_type TEXT NOT NULL,
  
  status TEXT DEFAULT 'queued',  -- → 'processing' → 'completed'/'failed'
  priority INTEGER DEFAULT 3,  -- 1=immediate, 2=within_week, 3=flexible
  
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### intent_matches

```sql
CREATE TABLE intent_matches (
  id UUID PRIMARY KEY,
  intent_id UUID REFERENCES user_intents(id),
  
  match_type TEXT NOT NULL,  -- 'property_listing', 'job_listing', etc.
  match_id UUID NOT NULL,
  match_score NUMERIC(3,2),  -- 0.00 to 1.00
  match_details JSONB,  -- Summary for notification
  
  notified BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## 🔧 Implementation Details

### record_user_intent Tool

```typescript
{
  name: 'record_user_intent',
  description: 'Record a complete user intent. ONLY call when ALL required info collected.',
  parameters: {
    intent_type: 'property_seeker' | 'job_seeker' | ...,
    location: string,  // REQUIRED
    location_coords?: { lat: number, lng: number },
    details: {
      // Intent-specific fields
      listing_type?: 'rent' | 'buy',
      bedrooms?: number,
      max_budget?: number,
      job_type?: 'full_time' | 'part_time' | 'gig',
      skills?: string[],
      product_type?: string,
      quantity?: number,
      // ... etc
    },
    urgency?: 'immediate' | 'within_week' | 'flexible',
    language: 'en' | 'rw' | 'fr' | 'sw',
    call_id?: string
  }
}
```

### Intent Processing Function

Runs every 5 minutes (via cron job):

1. **Fetch** queued intents (priority order)
2. **Match** against listings (properties, jobs, etc.)
3. **Store** matches in `intent_matches`
4. **Send** WhatsApp notification
5. **Update** intent status to `notified`

### Matching Logic

**Property Matching:**
```typescript
SELECT * FROM property_listings
WHERE city ILIKE '%${location}%'
  AND listing_type = '${rent/buy}'
  AND price <= ${max_budget}
  AND bedrooms >= ${bedrooms}
  AND status = 'active'
LIMIT 5
```

**Job Matching:**
```typescript
SELECT * FROM job_listings
WHERE location ILIKE '%${location}%'
  AND status = 'open'
LIMIT 5
```

**Farmer Matching (Seller → Buyer):**
```typescript
SELECT * FROM user_intents
WHERE intent_type = 'farmer_buyer'
  AND status = 'pending_match'
  AND details->>'product_type' = '${product}'
```

## 🧪 Testing

### Test Conversation

```
# Phone call starts
Agent: "Hello, this is EasyMO. How can I help you today?"

User: "I need a house"
Agent: "I can help you find a house! Are you looking to rent or buy?"

User: "Rent"
Agent: "Great! Which area are you looking in?"

User: "Kimironko"
Agent: "How many bedrooms do you need?"

User: "2"
Agent: "And what's your maximum budget per month?"

User: "300,000 RWF"
Agent: "Perfect! Let me confirm: You're looking for a 2-bedroom house to rent 
        in Kimironko, with a maximum budget of 300,000 RWF per month. 
        Is that correct?"

User: "Yes"
Agent: [Calls record_user_intent]
Agent: "I've saved your request. You'll receive a WhatsApp message with 
        matching properties. Is there anything else I can help you with?"

# Within 5 minutes, WhatsApp message received with matches
```

### Test Off-Topic Conversation

```
User: "What's the weather today?"
Agent: "I can only help with EasyMO services. Let me know if you need help 
        with transportation, housing, jobs, or our other services."

User: "Tell me a joke"
Agent: "I understand, but I'm specifically designed to help with EasyMO 
        services. Is there something I can help you with today?"

User: "OK, I need a ride"
Agent: "I can help with that! Where are you now?"
```

## 📊 Monitoring

### Query Recent Intents

```sql
SELECT 
  intent_type,
  location_text,
  status,
  details,
  created_at
FROM user_intents
ORDER BY created_at DESC
LIMIT 10;
```

### Check Processing Queue

```sql
SELECT 
  iq.status,
  iq.priority,
  ui.intent_type,
  ui.location_text,
  iq.retry_count,
  iq.last_error
FROM intent_processing_queue iq
JOIN user_intents ui ON iq.intent_id = ui.id
WHERE iq.status IN ('queued', 'processing')
ORDER BY iq.priority, iq.created_at;
```

### View Matches

```sql
SELECT 
  ui.intent_type,
  ui.location_text,
  im.match_type,
  im.match_score,
  im.match_details,
  im.notified
FROM intent_matches im
JOIN user_intents ui ON im.intent_id = ui.id
WHERE im.notified = false
ORDER BY im.created_at DESC;
```

## 🚀 Deployment

```bash
# Deploy all enhancements
./deploy-enhanced-call-center-agi.sh

# Or manually:
# 1. Apply database migrations
supabase db push --include-file 20251206120000_user_intents_system.sql
supabase db push --include-file 20251206121000_enhanced_call_center_agi.sql

# 2. Deploy edge functions
supabase functions deploy process-user-intents
supabase functions deploy wa-agent-call-center

# 3. Set environment variables in Supabase dashboard
# - WHATSAPP_ACCESS_TOKEN
# - WHATSAPP_PHONE_NUMBER_ID
# - OPENAI_API_KEY
```

## 📝 Environment Variables

Required for intent processing and notifications:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
WHATSAPP_ACCESS_TOKEN=EAAa...
WHATSAPP_PHONE_NUMBER_ID=123456789
OPENAI_API_KEY=sk-...
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
```

## 🎯 Success Metrics

Track these metrics to measure success:

1. **Guardrail Effectiveness**
   - % of off-topic requests redirected
   - % of conversations staying on-topic

2. **Location Collection**
   - % of intents with location
   - Average questions to collect location

3. **Intent Completeness**
   - % of intents with all required fields
   - Average fields per intent

4. **Matching Success**
   - % of intents matched
   - Average matches per intent
   - Time to first match

5. **Notification Delivery**
   - % of notifications sent successfully
   - Average time from intent to notification

## 🔄 Future Enhancements

1. **Smart Matching**
   - ML-based relevance scoring
   - User preference learning
   - Historical match feedback

2. **Multi-Stage Notifications**
   - Immediate: Top 3 matches
   - Daily: New matches digest
   - Weekly: Summary of all activity

3. **Intent Refinement**
   - Allow users to update intents via WhatsApp
   - Save search preferences
   - Alert when criteria change

4. **Analytics Dashboard**
   - Real-time intent processing stats
   - Match success rates
   - Popular intent types by region

## 📚 Additional Resources

- [Call Center AGI Implementation](./CALL_CENTER_AGI_IMPLEMENTATION.md)
- [WhatsApp Voice Calls Guide](./WHATSAPP_VOICE_CALLS_COMPLETE.md)
- [Ground Rules](./docs/GROUND_RULES.md)

---

**Last Updated:** 2025-12-06  
**Version:** 2.0  
**Status:** ✅ Production Ready
