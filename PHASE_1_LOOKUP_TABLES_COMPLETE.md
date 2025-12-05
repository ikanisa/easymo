# Phase 1 Implementation Complete: AI Lookup Tables

**Date**: December 6, 2025  
**Status**: ✅ Database tables created, TypeScript loader ready

---

## 📊 What Was Created

### 1. Database Migration
**File**: `supabase/migrations/20251206010000_create_ai_lookup_tables.sql`

Created 6 new lookup tables to eliminate hardcoded configurations:

| Table | Purpose | Rows Seeded | Replaces |
|-------|---------|-------------|----------|
| `service_verticals` | Service domains (mobility, insurance, etc.) | 12 | `packages/agents/src/config/service-catalog.ts::EASYMO_VERTICALS` |
| `job_categories` | Job types and categories | 12 | Hardcoded prompts in `jobs_agent.ts` |
| `property_types` | Property classification | 10 | Tool schema enums |
| `insurance_types` | Insurance product types | 6 | Tool schema enums |
| `moderation_rules` | Out-of-scope patterns | 11 | `service-catalog.ts::OUT_OF_SCOPE_PATTERNS` |
| `tool_enum_values` | Dynamic enums for AI tools | 19 | Hardcoded enums in tool definitions |

### 2. TypeScript Loader
**File**: `packages/agents/src/config/lookup-loader.ts`

New utility class with caching (5-minute TTL):

```typescript
import { LookupLoader } from '@/config/lookup-loader';

const loader = new LookupLoader(supabase);

// Get all verticals
const verticals = await loader.getServiceVerticals('RW');

// Detect vertical from query
const vertical = await loader.detectVerticalFromQuery('I need a taxi');

// Check if out of scope
const isOOS = await loader.isOutOfScope('What is the weather today?');

// Get job categories
const categories = await loader.getJobCategories('MT');

// Get tool enums dynamically
const agentIds = await loader.getToolEnumValues('agent_id');
```

### 3. Helper Functions (SQL)
Created in the migration:

- `get_tool_enum_values(p_enum_type)` - Fetch enum values for tools
- `is_query_out_of_scope(p_query)` - Check moderation rules
- `detect_vertical_from_query(p_query)` - Keyword-based detection

---

## 🚀 How to Deploy

### Step 1: Apply Migration

```bash
# Local Supabase
supabase db push

# Remote Supabase (production)
supabase db push --db-url "$DATABASE_URL"

# Or via Supabase Dashboard
# Copy migration file content and run in SQL Editor
```

### Step 2: Verify Tables Created

```bash
psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%vertical%' OR tablename LIKE '%job_categor%' OR tablename LIKE '%moderation%';"
```

Expected output:
```
       tablename       
-----------------------
 service_verticals
 job_categories
 property_types
 insurance_types
 moderation_rules
 tool_enum_values
```

### Step 3: Test Data Seeded

```sql
-- Check service verticals
SELECT slug, name, array_length(keywords, 1) as keyword_count 
FROM service_verticals 
WHERE is_active = true 
ORDER BY priority DESC;

-- Check job categories
SELECT slug, name FROM job_categories ORDER BY display_order;

-- Check moderation rules
SELECT rule_type, category, pattern FROM moderation_rules WHERE is_active = true;
```

---

## 📝 Usage Examples

### Example 1: Update General Broker to Use Database Verticals

**Before** (`packages/agents/src/tools/generalBrokerTools.ts`):
```typescript
// ❌ HARDCODED
vertical: z.enum(['mobility', 'commerce', 'hospitality', 'insurance', 
                  'property', 'legal', 'jobs', 'farming', 'marketing', 
                  'sora_video', 'support'])
```

**After**:
```typescript
// ✅ DYNAMIC
import { LookupLoader } from '../config/lookup-loader';

const loader = new LookupLoader(supabase);
const verticals = await loader.getServiceVerticals();
const verticalSlugs = verticals.map(v => v.slug);

vertical: z.enum(verticalSlugs as [string, ...string[]])
```

### Example 2: Replace CallCenterAGI Hardcoded Enums

**Before** (`supabase/functions/wa-agent-call-center/call-center-agi.ts`):
```typescript
// ❌ HARDCODED
{
  name: 'run_agent',
  parameters: {
    properties: {
      agent_id: { 
        type: 'string',
        enum: ['real-estate-rentals', 'rides-matching', 'jobs-marketplace', 
               'waiter-restaurants', 'insurance-broker', 'farmers-market'],
      },
    },
  },
}
```

**After**:
```typescript
// ✅ DYNAMIC
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data: agentEnums } = await supabase
  .from('tool_enum_values')
  .select('value')
  .eq('enum_type', 'agent_id')
  .eq('is_active', true)
  .order('display_order');

{
  name: 'run_agent',
  parameters: {
    properties: {
      agent_id: { 
        type: 'string',
        enum: agentEnums.map(e => e.value),
      },
    },
  },
}
```

### Example 3: Jobs Agent System Prompt from Database

**Before** (`supabase/functions/wa-webhook/domains/ai-agents/jobs_agent.ts`):
```typescript
// ❌ HARDCODED
private buildInstructions(): string {
  return `... 
JOB CATEGORIES:
- Construction & Manual Labor
- Driving & Delivery
... `;
}
```

**After**:
```typescript
// ✅ DYNAMIC
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async buildInstructions(): Promise<string> {
  const { data: categories } = await supabase
    .from('job_categories')
    .select('name, description')
    .eq('is_active', true)
    .order('display_order');

  const categoryList = categories
    .map(c => `- ${c.name}: ${c.description}`)
    .join('\n');

  return `... 
JOB CATEGORIES:
${categoryList}
... `;
}
```

### Example 4: Out-of-Scope Check

**Before** (`packages/agents/src/config/service-catalog.ts`):
```typescript
// ❌ HARDCODED
export const OUT_OF_SCOPE_PATTERNS = [
  /news|politics|election|government|president/i,
  /health|medical|doctor|medicine|covid|disease/i,
  // ... more patterns
];

export function isOutOfScope(query: string): boolean {
  return OUT_OF_SCOPE_PATTERNS.some(pattern => pattern.test(query));
}
```

**After**:
```typescript
// ✅ DYNAMIC - Use SQL function
const { data: isOOS } = await supabase.rpc('is_query_out_of_scope', {
  p_query: userQuery
});

if (isOOS) {
  return "I'm your EasyMO assistant. I can help with...";
}
```

---

## 🔄 Migration Checklist

### Phase 2: Update Code to Use Database (Week 2)

- [ ] Update `generalBrokerTools.ts` to load verticals from DB
- [ ] Update `call-center-agi.ts` to load agent enums from DB
- [ ] Update `jobs_agent.ts` to load categories from DB
- [ ] Update insurance tool schemas to use `insurance_types` table
- [ ] Update property tool schemas to use `property_types` table
- [ ] Replace `OUT_OF_SCOPE_PATTERNS` checks with SQL function
- [ ] Update agent-core to load base prompts from DB

### Phase 3: Remove Hardcoded Files (Week 3)

- [ ] Delete `supabase/functions/wa-webhook/shared/agent_configs.ts`
- [ ] Remove `getDefaultSystemPrompt()` methods from agent files
- [ ] Remove hardcoded enums from `service-catalog.ts` (keep only types)
- [ ] Remove hardcoded enums from `verticals.types.ts`

### Phase 4: Generate Types from Database (Week 4)

- [ ] Create build script to generate TypeScript types from DB
- [ ] Auto-generate `AgentType` from `ai_agents` table
- [ ] Auto-generate `EasyMOVertical` from `service_verticals` table
- [ ] Update CI/CD to regenerate types on schema changes

---

## 🧪 Testing

### Manual Tests

```bash
# Test vertical detection
psql $DATABASE_URL -c "SELECT detect_vertical_from_query('I need a ride to the airport');"
# Expected: mobility

# Test out-of-scope detection
psql $DATABASE_URL -c "SELECT is_query_out_of_scope('What is the weather today?');"
# Expected: true

# Test enum values
psql $DATABASE_URL -c "SELECT * FROM get_tool_enum_values('agent_id');"
# Expected: List of agent IDs
```

### Integration Tests

```typescript
import { LookupLoader } from '@/config/lookup-loader';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const loader = new LookupLoader(supabase);

// Test 1: Load verticals
const verticals = await loader.getServiceVerticals();
console.assert(verticals.length === 12, 'Expected 12 verticals');

// Test 2: Detect vertical
const vertical = await loader.detectVerticalFromQuery('I need insurance');
console.assert(vertical === 'insurance', 'Expected insurance vertical');

// Test 3: Out of scope
const isOOS = await loader.isOutOfScope('What is the weather?');
console.assert(isOOS === true, 'Weather should be out of scope');

// Test 4: Job categories
const categories = await loader.getJobCategories();
console.assert(categories.length >= 10, 'Expected at least 10 categories');
```

---

## 📋 Data Management

### Adding New Verticals

```sql
INSERT INTO service_verticals (slug, name, description, agent_slugs, keywords, priority)
VALUES (
  'healthcare',
  'Healthcare Services',
  'Medical appointments, pharmacy, telemedicine',
  ARRAY['health-assistant']::TEXT[],
  ARRAY['doctor', 'medicine', 'hospital', 'clinic', 'pharmacy']::TEXT[],
  13
);
```

### Adding New Job Categories

```sql
INSERT INTO job_categories (slug, name, description, display_order, keywords)
VALUES (
  'customer_service',
  'Customer Service',
  'Call center agents, support representatives',
  12,
  ARRAY['customer service', 'call center', 'support']::TEXT[]
);
```

### Adding Moderation Rules

```sql
INSERT INTO moderation_rules (rule_type, pattern, description, category, severity)
VALUES (
  'blocked',
  'suicide|self-harm|kill myself',
  'Mental health emergency - requires human intervention',
  'mental_health',
  'critical'
);
```

### Updating Tool Enums

```sql
INSERT INTO tool_enum_values (enum_type, value, label, description, display_order)
VALUES (
  'agent_id',
  'healthcare-assistant',
  'Healthcare Agent',
  'Medical appointments and pharmacy services',
  8
);
```

---

## 🔒 RLS Policies

All tables have Row-Level Security enabled:

- **Public Read**: Anonymous users can read active records
- **Admin Write**: Only admin/moderator roles can insert/update/delete
- **Moderation Rules**: Admin-only access

```sql
-- Example: Grant moderator access
UPDATE profiles SET role = 'moderator' WHERE user_id = 'user-uuid';
```

---

## 📊 Performance

### Caching Strategy

The `LookupLoader` class includes a 5-minute in-memory cache:

```typescript
const loader = new LookupLoader(supabase);

// First call - hits database
const verticals1 = await loader.getServiceVerticals(); // DB query

// Second call within 5 minutes - returns cached
const verticals2 = await loader.getServiceVerticals(); // Cache hit

// Clear cache if needed
loader.clearCache();

// Adjust cache TTL (default 5 minutes)
loader.setCacheTTL(10 * 60 * 1000); // 10 minutes
```

### Database Indexes

All lookup tables have indexes on:
- `slug` (unique lookups)
- `is_active` (filtering)
- `display_order` (sorting)
- Country arrays (GIN index for containment checks)

---

## 🐛 Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution**: Tables are created with `IF NOT EXISTS`, so this is safe. Verify with:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_verticals';
```

### Issue: TypeScript loader can't find types

**Solution**: Ensure `@supabase/supabase-js` is installed:
```bash
pnpm add @supabase/supabase-js
```

### Issue: Cached data is stale

**Solution**: Clear cache manually or reduce TTL:
```typescript
loader.clearCache();
loader.setCacheTTL(60 * 1000); // 1 minute for dev
```

---

## 📚 Next Steps

1. **Deploy migration** to production Supabase
2. **Update one service** at a time (start with General Broker)
3. **Test thoroughly** before removing hardcoded files
4. **Monitor performance** - check cache hit rates
5. **Document changes** - update agent README files

---

## 🎯 Success Criteria

- [x] Migration creates all 6 tables
- [x] All tables seeded with initial data
- [x] Helper functions work correctly
- [x] TypeScript loader compiles without errors
- [x] RLS policies applied
- [ ] At least one service uses database lookups (Phase 2)
- [ ] All hardcoded configs removed (Phase 3)
- [ ] Types auto-generated from DB (Phase 4)

---

**Status**: ✅ Phase 1 Complete - Ready for Phase 2 implementation
