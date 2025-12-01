# Next Actions - EasyMO Platform

**Updated**: December 1, 2025  
**Branch**: `feature/webhook-consolidation-complete`

## ✅ Completed Today

### 1. Critical WhatsApp Mobility Bug - FIXED & DEPLOYED
- **Issue**: Empty titles in WhatsApp list messages causing API 400 errors
- **Fix**: Applied `safeRowTitle()` wrapper to match row titles
- **Status**: ✅ Deployed to production
- **Files**: 
  - `supabase/functions/wa-webhook-mobility/handlers/nearby.ts`
  - `supabase/functions/wa-webhook-mobility/handlers/schedule/booking.ts`
- **Commit**: `4024052e`
- **Documentation**: `CRITICAL_FIX_DEPLOYED.md`

### 2. Agent Architecture Verification - CONFIRMED WORKING
- **Finding**: Agents ARE using database configuration (audit was wrong)
- **Status**: ✅ Architecture verified, documented
- **Infrastructure**: AgentConfigLoader + ToolExecutor fully implemented
- **Documentation**: `IMPLEMENTATION_STATUS_AGENTS.md`

## ⚠️ Pending (Must Do Today/Tomorrow)

### 1. Apply Database Migration
**Priority**: HIGH  
**File**: `supabase/migrations/20251201153819_add_missing_agents.sql`

**What it does**:
- Adds `marketplace` agent to replace deprecated `broker`
- Adds `support` agent for general help
- Creates `marketplace_listings` table
- Creates `support_tickets` table
- Updates WhatsApp home menu alignment
- Adds country code validation (RW, CD, BI, TZ only)

**Why pending**: Migration history diverged between local and remote

**How to apply** (choose one):

#### Option A: Supabase Dashboard (RECOMMENDED - Safest)
```bash
# 1. Copy the migration SQL
cat supabase/migrations/20251201153819_add_missing_agents.sql

# 2. Go to Supabase Dashboard
https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new

# 3. Paste SQL and click "Run"
```

#### Option B: Repair Migration History
```bash
cd /Users/jeanbosco/workspace/easymo

# Pull current remote schema
supabase db pull

# Mark diverged migrations as applied
supabase migration repair --status applied [list of timestamps from error]

# Then push new migration
supabase db push
```

#### Option C: Direct psql (If you have DB password)
```bash
# Get connection string from Supabase dashboard
export DATABASE_URL="postgresql://postgres:[YOUR_PASSWORD]@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

psql $DATABASE_URL -f supabase/migrations/20251201153819_add_missing_agents.sql
```

**Verification after applying**:
```sql
-- Check agents were added
SELECT slug, name, is_active FROM ai_agents 
WHERE slug IN ('marketplace', 'support', 'broker');

-- Expected:
-- marketplace | Marketplace AI Agent | true
-- support     | Support AI Agent     | true  
-- broker      | Business Broker      | false (deprecated)

-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('marketplace_listings', 'support_tickets');
```

### 2. Test Production After Migration
**Priority**: HIGH

```bash
# Test via WhatsApp to your test number
# 1. Send "menu" to your WhatsApp bot
# 2. Verify "Marketplace" appears (not "Business Broker")
# 3. Verify "Support" appears
# 4. Select "Marketplace" - should work
# 5. Select "Support" - should work
```

### 3. Monitor Production Logs
**Priority**: MEDIUM

Check Supabase logs for:
```
✅ No more "title is required" errors
✅ Match delivery success rate
✅ Agent config loaded from database (not fallback)
```

Dashboard: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/logs/edge-functions

Look for:
```json
// Good - agent using database
{"event": "AGENT_CONFIG_CACHE_HIT", "source": "database"}

// Bad - agent using fallback
{"event": "AGENT_USING_DEFAULT_PROMPT", "reason": "no_db_instructions"}
```

## 🔴 High Priority (This Week)

### 1. Populate System Instructions in Database
**Status**: Missing for most agents  
**Impact**: Agents using hardcoded fallback prompts

**Task**: For each agent, insert into `ai_agent_system_instructions`:

```sql
-- Example: Farmer Agent
INSERT INTO ai_agent_system_instructions (
  agent_id,
  code,
  title,
  instructions,
  guardrails,
  memory_strategy,
  is_active
)
SELECT 
  id,
  'farmer_default',
  'Farmer Agent - Default Instructions',
  'You are a knowledgeable and supportive farmer AI assistant at easyMO Farmers Market.
  
Your role:
- Help farmers find market prices for crops
- Provide agricultural advice and best practices
- Connect farmers with buyers
- Share weather updates and farming tips
- Assist with produce listings and sales

Capabilities:
- Search current market prices
- List produce for sale
- Check weather forecasts
- Provide crop guidance
- Connect with agricultural experts

Always be:
- Warm and encouraging
- Patient with technical questions
- Practical and actionable
- Culturally aware (Rwanda, DRC, Burundi, Tanzania)
- Supportive of small-scale farmers',
  'Never provide medical advice. Always recommend professional agronomists for serious pest/disease issues. Respect local farming traditions.',
  'conversational',
  true
FROM ai_agents WHERE slug = 'farmer';

-- Repeat for: waiter, jobs, real_estate, rides, insurance, marketplace, support
```

**Files to reference** (for prompt content):
- `supabase/functions/wa-webhook-ai-agents/agents/farmer-agent.ts` → `getDefaultSystemPrompt()`
- Same for other agents

### 2. Implement Real Tool Logic
**Status**: Many tools are placeholders  
**Impact**: Tools called but don't execute real actions

**File**: `supabase/functions/_shared/tool-executor.ts`

**Placeholders to replace**:
```typescript
// BEFORE (placeholder)
private async executeDeepSearchTool(...): Promise<unknown> {
  return {
    message: "Deep search not yet implemented",
  };
}

// AFTER (real implementation)
private async executeDeepSearchTool(
  inputs: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<unknown> {
  const { query, domain } = inputs;
  
  // Execute semantic search
  const { data } = await this.supabase.rpc('semantic_search_universal', {
    search_query: query as string,
    domain_filter: domain as string,
    limit_results: 10
  });
  
  return {
    success: true,
    results: data,
    count: data?.length || 0
  };
}
```

**Tools needing implementation**:
- `executeDeepSearchTool` - Semantic search
- `executeMoMoTool` - Mobile money payments
- `executeMarketplaceTool` - Listing search/create
- `executeSupportTicketTool` - Create support tickets
- `executeWeatherTool` - Weather API integration

### 3. Consolidate Duplicate Apps
**Status**: Multiple versions causing confusion

**Action**: Archive/remove:
```bash
cd /Users/jeanbosco/workspace/easymo

# Archive (don't delete yet)
git mv admin-app-v2 _archive/admin-app-v2
git mv bar-manager-app _archive/bar-manager-app  
git mv bar-manager-final _archive/bar-manager-final

# Keep only:
# - admin-app (main)
# - bar-manager-production (production)

git commit -m "chore: Archive duplicate app directories

Keeps only production versions:
- admin-app (Next.js 15 admin panel)
- bar-manager-production (deployed bar manager)
"
```

## 🟡 Medium Priority (Next Week)

### 1. Consolidate Edge Functions
**Issue**: 80+ edge functions with duplicated logic  
**Goal**: Reduce to ~10 core functions

**Approach**:
```
Current:
├── wa-webhook
├── wa-webhook-core
├── wa-webhook-unified
├── wa-webhook-ai-agents
├── wa-webhook-mobility
├── wa-webhook-insurance
├── wa-webhook-jobs
├── ... (75 more)

Proposed:
├── wa-webhook (main entry point - routes to others)
├── wa-webhook-ai (all AI agents via AgentOrchestrator)
├── wa-webhook-mobility (rides only)
├── wa-webhook-transactions (payments, wallet)
├── wa-webhook-admin (admin functions)
└── _shared (utilities)
```

**Files to review**:
- `supabase/functions/_shared/agent-orchestrator.ts` - Use this!
- `supabase/functions/wa-webhook-unified/` - Should become main entry

### 2. Fix Session Management
**Issue**: Multiple session tables, inconsistent approaches  
**Tables**:
- `agent_chat_sessions` (used by AgentOrchestrator)
- `whatsapp_conversations` (legacy)
- In-memory sessions (some functions)

**Action**: Consolidate to `agent_chat_sessions`

### 3. Documentation Cleanup
**Issue**: 100+ markdown files in `client-pwa/`

**Action**:
```bash
cd client-pwa

# Create single entry point
cat > DEVELOPMENT.md << 'EOF'
# Client PWA Development Guide

## Quick Start
npm install
npm run dev

## Build
npm run build

## Deploy
npm run deploy

## Documentation
- Architecture: docs/ARCHITECTURE.md
- Deployment: docs/DEPLOYMENT.md
- Testing: docs/TESTING.md
EOF

# Archive old docs
mkdir _archive/docs
mv DEPLOYMENT*.md START_HERE*.md IMPLEMENTATION*.md _archive/docs/
```

## 🟢 Low Priority (Future)

### 1. Admin UI for Agent Management
Build interface to edit:
- System prompts
- Tool configurations
- A/B test different prompts
- View analytics

### 2. Multi-Language System Instructions
Add language-specific prompts:
```sql
-- ai_agent_system_instructions
ALTER TABLE ai_agent_system_instructions 
ADD COLUMN language TEXT DEFAULT 'en';

-- Support en, sw, rw, fr per country
```

### 3. Analytics Dashboard
Track:
- Agent usage by type
- Tool execution success rates
- User satisfaction scores
- Prompt performance (A/B testing)

## 🛠️ Development Commands

```bash
# Work on this branch
git checkout feature/webhook-consolidation-complete

# Deploy mobility fix (already done)
supabase functions deploy wa-webhook-mobility --no-verify-jwt --legacy-bundle

# Deploy other functions
supabase functions deploy wa-webhook-ai-agents --no-verify-jwt --legacy-bundle

# Test locally
supabase functions serve wa-webhook-mobility
curl -X POST http://localhost:54321/functions/v1/wa-webhook-mobility \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check logs
supabase functions logs wa-webhook-mobility --tail
```

## 📊 Success Metrics

Track weekly:
- [ ] WhatsApp API 400 errors: 0
- [ ] Match delivery success: >95%
- [ ] Agent config from database: >90%
- [ ] Tool execution success: >90%
- [ ] User session retention: >80%

## 🚨 Rollback Plan

If production issues:
```bash
# Revert WhatsApp fix
git revert 4024052e
supabase functions deploy wa-webhook-mobility --no-verify-jwt --legacy-bundle

# Revert migration (if applied)
# Run opposite SQL statements or restore from backup
```

## 📞 Contacts

- **Deployment Issues**: Check Supabase dashboard
- **Migration Issues**: Use SQL Editor in dashboard
- **GitHub Issues**: https://github.com/ikanisa/easymo/issues

---

**Next Immediate Action**: Apply database migration via Supabase Dashboard SQL Editor (Option A above)
