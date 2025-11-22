# 🚀 Manual Deployment Guide - Rides & Insurance Agents

**Use this guide if automated `supabase db push` fails**

---

## ✅ Step 1: Deploy Edge Function (COMPLETE)

The wa-webhook-ai-agents function is already deployed:
- ✅ URL: https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents
- ✅ Version: 3.0.0
- ✅ Status: Healthy

---

## ⏳ Step 2: Deploy Database Schema

### Open Supabase SQL Editor

1. Go to: **https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql**
2. Click "New Query"

### Run Schema SQL

Copy the entire content from:
```
/tmp/deploy_rides_insurance_remote.sql
```

Or manually copy this SQL:

<details>
<summary>Click to view SQL (117 lines)</summary>

\`\`\`sql
-- Check if ai_agents table exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_agents') THEN
    RAISE EXCEPTION 'AI Agents infrastructure not found. Please apply base migrations first.';
  END IF;
END $$;

-- Create Rides & Insurance tables
BEGIN;

CREATE TABLE IF NOT EXISTS public.rides_saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  label text,
  address_text text,
  lat double precision,
  lng double precision,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rides_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  driver_user_id uuid REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status text DEFAULT 'pending',
  price_estimate numeric,
  currency text DEFAULT 'RWF',
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rides_driver_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  is_online boolean DEFAULT false,
  current_lat double precision,
  current_lng double precision,
  last_seen_at timestamptz DEFAULT now(),
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insurance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  vehicle_identifier text,
  vehicle_metadata jsonb,
  owner_name text,
  owner_id_number text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insurance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insurance_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  document_type text,
  file_url text,
  wa_message_id text,
  metadata jsonb,
  uploaded_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insurance_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.insurance_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  intent_id uuid REFERENCES public.ai_agent_intents(id) ON UPDATE CASCADE ON DELETE SET NULL,
  request_type text,
  status text DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  quote_details jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rides_saved_locations_user_id ON public.rides_saved_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_trips_rider_user_id ON public.rides_trips(rider_user_id);
CREATE INDEX IF NOT EXISTS idx_rides_trips_driver_user_id ON public.rides_trips(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_rides_trips_status ON public.rides_trips(status);
CREATE INDEX IF NOT EXISTS idx_rides_trips_scheduled_at ON public.rides_trips(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_driver_status_user_id ON public.rides_driver_status(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status_online ON public.rides_driver_status(is_online) WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_insurance_profiles_user_id ON public.insurance_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_documents_profile_id ON public.insurance_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_profile_id ON public.insurance_quote_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_insurance_quote_requests_status ON public.insurance_quote_requests(status);

COMMIT;

SELECT 'Schema created successfully!' as status,
       (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'rides%') as rides_tables,
       (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'insurance%') as insurance_tables;
\`\`\`

</details>

**Expected Result:**
```
status: Schema created successfully!
rides_tables: 3
insurance_tables: 3
```

---

## ⏳ Step 3: Load Seed Data

In the same SQL Editor (or new query):

Copy the entire content from:
```
/tmp/deploy_rides_insurance_seed.sql
```

**Expected Result:**
```
status: Seed data loaded!
agents: 2
tools: 8
tasks: 8
kbs: 7
```

---

## ✅ Step 4: Verify Deployment

Run this query in SQL Editor:

\`\`\`sql
SELECT 
  slug, 
  name, 
  is_active,
  (SELECT COUNT(*) FROM ai_agent_tools WHERE agent_id = a.id) as tools,
  (SELECT COUNT(*) FROM ai_agent_tasks WHERE agent_id = a.id) as tasks,
  (SELECT COUNT(*) FROM ai_agent_knowledge_bases WHERE agent_id = a.id) as kbs
FROM ai_agents a
WHERE slug IN ('rides', 'insurance')
ORDER BY slug;
\`\`\`

**Expected Result:**
```
slug      | name                | is_active | tools | tasks | kbs
----------|---------------------|-----------|-------|-------|-----
insurance | Insurance AI Agent  | t         | 4     | 4     | 4
rides     | Rides AI Agent      | t         | 4     | 4     | 3
```

---

## 🧪 Step 5: Test the Deployment

### Test Function Health
\`\`\`bash
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents/health
\`\`\`

### Test Rides Agent
\`\`\`bash
curl -X POST "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "from": "+250788999888",
    "body": "Need a ride to Kigali Airport",
    "type": "text"
  }'
\`\`\`

### Test Insurance Agent
\`\`\`bash
curl -X POST "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-ai-agents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "from": "+250788999777",
    "body": "I need insurance for my car",
    "type": "text"
  }'
\`\`\`

---

## 📊 What You Should See

After successful deployment:

1. **Database Tables:**
   - rides_saved_locations
   - rides_trips
   - rides_driver_status
   - insurance_profiles
   - insurance_documents
   - insurance_quote_requests

2. **AI Agents:**
   - rides (4 tools, 4 tasks, 3 KBs)
   - insurance (4 tools, 4 tasks, 4 KBs)

3. **Function Behavior:**
   - Routes "ride" keywords → Rides Agent
   - Routes "insurance" keywords → Insurance Agent
   - Parses intents (find_driver, get_quote, etc.)
   - Creates database records
   - Returns persona-aware responses

---

## 🎉 SUCCESS CRITERIA

✅ Schema SQL runs without errors  
✅ Seed SQL returns 2 agents, 8 tools, 8 tasks, 7 KBs  
✅ Verification query shows both agents active  
✅ Function health check returns 200  
✅ Test messages trigger correct agents  

---

## ❌ Troubleshooting

### Error: "ai_agents table does not exist"
**Solution:** Base AI agent infrastructure needs to be deployed first.
Run these migrations first:
- 20251121184617_ai_agent_ecosystem_whatsapp_first.sql
- 20251121191011_ai_agent_ecosystem.sql

### Error: "whatsapp_users does not exist"
**Solution:** WhatsApp infrastructure missing.
Contact admin for full schema deployment.

### Error: "ON CONFLICT DO NOTHING" not working
**Solution:** You may already have the agents installed.
Check with:
\`\`\`sql
SELECT * FROM ai_agents WHERE slug IN ('rides', 'insurance');
\`\`\`

---

**Files:**
- Schema SQL: `/tmp/deploy_rides_insurance_remote.sql`
- Seed SQL: `/tmp/deploy_rides_insurance_seed.sql`
- This Guide: `DEPLOY_RIDES_INSURANCE_MANUAL.md`

**Time Required:** ~5 minutes

**Next:** Configure WhatsApp webhook to point to deployed function!
