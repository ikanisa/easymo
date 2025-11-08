# 🚀 AI Agents Quick Start Guide

Get your AI Agents up and running in **5 minutes**!

---

## Prerequisites

- ✅ Supabase CLI installed (`brew install supabase/tap/supabase`)
- ✅ OpenAI API key with GPT-4 access
- ✅ WhatsApp Business API credentials (optional for now)
- ✅ Node.js 18+ and pnpm installed

---

## Step 1: Set Up Environment

```bash
cd /Users/jeanbosco/workspace/easymo-

# Copy environment template
cp .env.example .env

# Edit .env and add your keys:
# - OPENAI_API_KEY=sk-proj-...
# - SUPABASE_URL (will be set by supabase start)
# - SUPABASE_SERVICE_ROLE_KEY (will be set by supabase start)
```

**Minimum Required**:
```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

---

## Step 2: Start Supabase

```bash
# Start local Supabase instance
supabase start

# This will output:
# - API URL: http://localhost:54321
# - DB URL: postgresql://...
# - anon key: eyJh...
# - service_role key: eyJh...
```

**Save these credentials** - you'll need them!

---

## Step 3: Apply Database Schema

```bash
# Push all migrations to database
supabase db push

# Verify tables were created
supabase db diff
```

**Expected tables**:
- ✅ `scheduled_trips`
- ✅ `travel_patterns`
- ✅ `properties`
- ✅ `agent_sessions`
- ✅ `agent_quotes`

---

## Step 4: Deploy Agents (One-Command)

```bash
# Run automated deployment script
./scripts/deploy-agents.sh
```

This script will:
1. ✅ Check environment variables
2. ✅ Apply database migrations
3. ✅ Set function secrets
4. ✅ Deploy all 4 agents
5. ✅ Run basic tests

**Alternative: Manual Deployment**

```bash
# Deploy each agent individually
supabase functions deploy agents/property-rental
supabase functions deploy agents/schedule-trip
supabase functions deploy agents/quincaillerie
supabase functions deploy agents/shops

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-proj-...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJh...
```

---

## Step 5: Test Agents

```bash
# Run comprehensive test suite
./scripts/test-agents.sh
```

**OR test manually**:

```bash
# Get Supabase URL and key
SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $NF}')
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $NF}')

# Test Property Rental Agent
curl -X POST "$SUPABASE_URL/functions/v1/agents/property-rental" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-123",
    "action": "find",
    "rentalType": "long_term",
    "bedrooms": 3,
    "maxBudget": 500000,
    "location": {
      "latitude": -1.9536,
      "longitude": 30.0606
    }
  }'

# Test Schedule Trip Agent
curl -X POST "$SUPABASE_URL/functions/v1/agents/schedule-trip" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-123",
    "action": "get_predictions"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "searchId": "uuid...",
  "message": "🏠 *Available Properties:*..."
}
```

---

## Step 6: Monitor & Debug

### View Logs
```bash
# View function logs
supabase functions logs agents/property-rental

# Follow logs in real-time
supabase functions logs agents/property-rental --follow
```

### Check Database
```bash
# Open Supabase Studio
supabase db remote list

# Or visit: http://localhost:54323
```

### View Metrics
```bash
# Check agent session
supabase db execute "SELECT * FROM agent_sessions ORDER BY created_at DESC LIMIT 5;"

# Check agent quotes
supabase db execute "SELECT * FROM agent_quotes ORDER BY created_at DESC LIMIT 5;"
```

---

## Common Issues & Solutions

### Issue: "Supabase command not found"
**Solution**:
```bash
brew install supabase/tap/supabase
```

### Issue: "Connection refused to localhost:54321"
**Solution**:
```bash
supabase stop
supabase start
```

### Issue: "OpenAI API error: Unauthorized"
**Solution**:
- Check your `OPENAI_API_KEY` is valid
- Ensure you have GPT-4 access
- Run: `supabase secrets set OPENAI_API_KEY=sk-proj-...`

### Issue: "Function not found"
**Solution**:
```bash
# Redeploy function
supabase functions deploy agents/property-rental --no-verify-jwt
```

### Issue: "Database tables not found"
**Solution**:
```bash
# Reapply migrations
supabase db reset
supabase db push
```

---

## Usage Examples

### Example 1: Schedule a Daily Commute

```bash
curl -X POST "$SUPABASE_URL/functions/v1/agents/schedule-trip" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "action": "schedule",
    "pickupLocation": {
      "latitude": -1.9536,
      "longitude": 30.0606,
      "address": "Home"
    },
    "dropoffLocation": {
      "latitude": -1.9440,
      "longitude": 30.0619,
      "address": "Office"
    },
    "scheduledTime": "2025-01-10T08:00:00Z",
    "vehiclePreference": "Moto",
    "recurrence": "weekdays",
    "notificationMinutes": 30
  }'
```

**Response**:
```
✅ Trip Scheduled Successfully!

📅 Schedule: Every weekday
⏰ Time: 08:00 AM
📍 From: Home
📍 To: Office
🚗 Vehicle: Moto

I'll notify you 30 minutes before the trip!
```

### Example 2: Find a Property

```bash
curl -X POST "$SUPABASE_URL/functions/v1/agents/property-rental" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-456",
    "action": "find",
    "rentalType": "long_term",
    "bedrooms": 3,
    "minBudget": 300000,
    "maxBudget": 600000,
    "location": {
      "latitude": -1.9536,
      "longitude": 30.0606,
      "address": "Kigali"
    },
    "amenities": ["WiFi", "Parking", "Security"]
  }'
```

**Response**:
```
🏠 Available Properties:

*Option 1*
📍 Kimironko, Kigali
📏 Distance: 2.5km
🛏️ Bedrooms: 3
🚿 Bathrooms: 2

💰 Pricing:
  Monthly Rent: 450,000 RWF (8% discount!)
  Deposit: 900,000 RWF

✨ Amenities:
  • WiFi
  • Parking
  • 24/7 Security
```

### Example 3: Analyze Travel Patterns

```bash
curl -X POST "$SUPABASE_URL/functions/v1/agents/schedule-trip" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "action": "analyze_patterns"
  }'
```

**Response**:
```
📊 Your Travel Pattern Analysis:

*🛣️ Most Frequent Routes:*
1. Home → Office (15 times, 65%)
2. Office → Gym (5 times, 22%)

*⏰ Typical Travel Times:*
• Morning: 68% of trips
• Evening: 32% of trips

*💡 Insights:*
• You have consistent morning commute patterns
• Consider scheduling recurring trips to save time
• Peak travel hours: 8-9 AM, 5-6 PM
```

---

## Next Steps

### ✅ Completed
- [x] Environment setup
- [x] Database deployed
- [x] Agents deployed
- [x] Basic testing

### 🎯 To Do
- [ ] Integrate with WhatsApp webhook
- [ ] Add real vendor communication
- [ ] Build admin panel UI
- [ ] Set up monitoring dashboard
- [ ] Deploy to production

---

## Documentation

- 📋 **Full Status Report**: `AGENTS_FINAL_STATUS_REPORT.md`
- 📚 **Agent Catalog**: `AGENTS_INDEX.md`
- 🔗 **Integration Guide**: `AGENT_INTEGRATION_GUIDE.md`
- ✅ **Implementation Checklist**: `AGENTS_PHASE1_CHECKLIST.md`

---

## Support

**Need help?**

1. Check the documentation files above
2. View function logs: `supabase functions logs <agent-name>`
3. Check database: http://localhost:54323
4. Review code comments in `supabase/functions/agents/`

---

## Quick Commands Reference

```bash
# Start/Stop Supabase
supabase start
supabase stop
supabase status

# Deploy
./scripts/deploy-agents.sh

# Test
./scripts/test-agents.sh

# View logs
supabase functions logs agents/property-rental
supabase functions logs agents/schedule-trip

# Database
supabase db push              # Apply migrations
supabase db diff              # See changes
supabase db reset             # Reset database
supabase db execute "SELECT * FROM agent_sessions;"

# Functions
supabase functions deploy agents/property-rental
supabase functions list
supabase secrets set KEY=value
```

---

**🎉 You're all set! Your AI Agents are ready to use.**

**Test URL**: `http://localhost:54321/functions/v1/agents/`

---

*Last Updated: 2025-01-08*
