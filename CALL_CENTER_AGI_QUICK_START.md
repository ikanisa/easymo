# Call Center AGI - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Apply Database Migration

```bash
# Navigate to project root
cd /path/to/easymo

# Apply the AGI migration
supabase db push

# OR manually via psql
psql $DATABASE_URL -f supabase/migrations/20251206000000_call_center_agi_complete.sql
```

**What this creates:**
- ✅ Call Center agent in `ai_agents` table
- ✅ Persona with voice-optimized traits
- ✅ System instructions with full prompt
- ✅ 20+ tools in `ai_agent_tools`
- ✅ 14 predefined tasks

### 2. Deploy Edge Function

```bash
# Deploy the call center function
supabase functions deploy wa-agent-call-center

# Verify deployment
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-agent-call-center/health
```

**Expected Health Check:**
```json
{
  "status": "healthy",
  "mode": "agi",
  "tools_available": 20
}
```

### 3. Test Basic Functionality

**Test 1: Profile Creation**
```bash
# Simulate WhatsApp message
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/wa-agent-call-center \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "+250788123456",
            "id": "test-1",
            "type": "text",
            "text": {"body": "Hello"},
            "timestamp": "1234567890"
          }]
        }
      }]
    }]
  }'
```

**Test 2: A2A Consultation**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/wa-agent-call-center \
  -H "X-Agent-Consultation: true" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need a ride to Kimironko",
    "sessionId": "test-session"
  }'
```

### 4. Verify Database Configuration

```sql
-- Check agent exists
SELECT slug, name, is_active 
FROM ai_agents 
WHERE slug = 'call_center';

-- Check tools loaded
SELECT COUNT(*) as tool_count 
FROM ai_agent_tools 
WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'call_center');

-- Should return: tool_count = 20+

-- Check tasks loaded
SELECT COUNT(*) as task_count 
FROM ai_agent_tasks 
WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'call_center');

-- Should return: task_count = 14
```

## 🎯 Quick Test Scenarios

### Scenario 1: Ride Request
**User:** "I want a ride to Kimironko"  
**Expected:** AGI creates profile, searches knowledge, explains ride booking

### Scenario 2: Property Listing
**User:** "I want to list my apartment for rent"  
**Expected:** AGI collects details (bedrooms, location, price), creates listing

### Scenario 3: Job Search
**User:** "I'm looking for a job as a driver"  
**Expected:** AGI registers candidate, collects skills, offers job matching

### Scenario 4: Wallet Balance
**User:** "How many tokens do I have?"  
**Expected:** AGI gets profile, retrieves balance, responds verbally

## 📊 Quick Verification Checklist

- [ ] Migration applied successfully
- [ ] Agent appears in `ai_agents` table
- [ ] 20+ tools in `ai_agent_tools`
- [ ] 14 tasks in `ai_agent_tasks`
- [ ] System instructions loaded
- [ ] Edge function deployed
- [ ] Health check returns `mode: "agi"`
- [ ] Test message processed
- [ ] Profile created in database

## ⚙️ Configuration

### Environment Variables

```bash
# Required for AGI
CALL_CENTER_USE_AGI=true  # Enable full AGI mode (default)

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# WhatsApp
WA_VERIFY_TOKEN=your-token
WHATSAPP_APP_SECRET=your-secret
```

### Feature Flags

```bash
# Switch between AGI and Basic mode
CALL_CENTER_USE_AGI=true   # Full AGI with all tools
CALL_CENTER_USE_AGI=false  # Basic collaboration mode
```

## 🔧 Troubleshooting

### Issue: Tools not executing
```bash
# Check mode
curl .../health | jq '.mode'
# Should return: "agi"

# Check env var
echo $CALL_CENTER_USE_AGI
# Should be: "true" or empty (defaults to true)
```

### Issue: Database config not loading
```sql
-- Verify agent exists
SELECT * FROM ai_agents WHERE slug = 'call_center';

-- If missing, re-run migration
\i supabase/migrations/20251206000000_call_center_agi_complete.sql
```

### Issue: A2A calls failing
```bash
# Check specialist agents deployed
supabase functions list

# Expected:
# - wa-agent-call-center (AGI)
# - wa-agent-farmers (specialist)
# - wa-agent-waiter (specialist)
# - etc.
```

## 📚 Next Steps

1. **Read Full Documentation:** `CALL_CENTER_AGI_IMPLEMENTATION.md`
2. **Configure WhatsApp Webhook:** Point to your edge function
3. **Test Voice Calls:** Enable WhatsApp calling
4. **Monitor Logs:** Check Supabase Functions logs
5. **Tune Prompts:** Update system instructions in database

## 🎓 Training the AGI

### Update System Prompt
```sql
UPDATE ai_agent_system_instructions 
SET instructions = 'Your custom prompt...'
WHERE agent_id = (SELECT id FROM ai_agents WHERE slug = 'call_center')
AND code = 'CALL-CENTER-AGI-SYSTEM';
```

### Add Custom Tool
```sql
INSERT INTO ai_agent_tools (agent_id, name, display_name, tool_type, description, input_schema, output_schema, config, is_active)
SELECT 
  id,
  'custom_tool',
  'My Custom Tool',
  'function',
  'Tool description',
  '{"type": "object", "properties": {...}}',
  '{"type": "object"}',
  '{"handler": "custom.handler"}',
  true
FROM ai_agents WHERE slug = 'call_center';
```

### Add Custom Task
```sql
INSERT INTO ai_agent_tasks (agent_id, code, name, description, trigger_description, tools_used, output_description, requires_human_handoff, metadata)
SELECT
  id,
  'CUSTOM_TASK',
  'My Custom Task',
  'Task description',
  'User says: "trigger phrase"',
  ARRAY['tool1', 'tool2'],
  'Expected outcome',
  false,
  '{"category": "custom", "priority": "medium"}'
FROM ai_agents WHERE slug = 'call_center';
```

## 📞 Production Checklist

Before going live:

- [ ] All migrations applied to production DB
- [ ] Edge function deployed to production
- [ ] Environment variables configured
- [ ] WhatsApp webhook configured and verified
- [ ] Test calls completed successfully
- [ ] Logging and monitoring enabled
- [ ] Knowledge base populated
- [ ] Specialist agents deployed
- [ ] Rate limiting configured
- [ ] Error handling tested

## 🎉 Success Indicators

Your AGI is working when:

1. ✅ Health check returns `"mode": "agi"` with `"tools_available": 20+`
2. ✅ Test messages create profiles in database
3. ✅ Logs show tool executions
4. ✅ A2A consultations route to specialists
5. ✅ Knowledge base searches return results
6. ✅ Voice responses are short and clear
7. ✅ Call summaries logged to database

## 📖 Resources

- **Full Docs:** `CALL_CENTER_AGI_IMPLEMENTATION.md`
- **Migration:** `supabase/migrations/20251206000000_call_center_agi_complete.sql`
- **AGI Code:** `supabase/functions/wa-agent-call-center/call-center-agi.ts`
- **Spec Reference:** Your original spec in this conversation

---

**Ready to deploy?** Follow the steps above and you'll have a production-ready Call Center AGI in under 10 minutes! 🚀
