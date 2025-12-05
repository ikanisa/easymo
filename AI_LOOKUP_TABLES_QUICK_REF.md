# AI Lookup Tables - Quick Reference

**TL;DR**: Use database tables instead of hardcoded configurations.

---

## 🔍 Tables Reference

### `service_verticals`
**Purpose**: Service domains (mobility, insurance, jobs, etc.)

```typescript
// ❌ OLD: Hardcoded
const VERTICALS = ['mobility', 'insurance', 'jobs', ...];

// ✅ NEW: Database-driven
const { data } = await supabase
  .from('service_verticals')
  .select('slug, name, keywords')
  .eq('is_active', true)
  .order('priority', { ascending: false });
```

**Columns**: slug, name, description, icon, agent_slugs[], keywords[], is_active, priority, active_countries[]

---

### `job_categories`
**Purpose**: Job types and hierarchical categories

```typescript
// ❌ OLD: Hardcoded in prompts
const categories = "Construction, Driving, Retail...";

// ✅ NEW: Database-driven
const { data } = await supabase
  .from('job_categories')
  .select('name, description')
  .eq('is_active', true)
  .order('display_order');
```

**Columns**: slug, name, description, icon, parent_category_id, is_active, display_order, keywords[]

---

### `property_types`
**Purpose**: Property classification (apartment, house, villa, etc.)

```typescript
// ❌ OLD: Hardcoded enum
enum: ['apartment', 'house', 'villa', 'commercial']

// ✅ NEW: Database-driven
const { data } = await supabase
  .from('property_types')
  .select('slug')
  .eq('is_active', true)
  .eq('is_residential', true);
```

**Columns**: slug, name, description, icon, is_residential, is_commercial, is_active, display_order

---

### `insurance_types`
**Purpose**: Insurance product types (motor, health, travel, etc.)

```typescript
// ❌ OLD: Hardcoded enum
enum: ['motor', 'health', 'travel', 'life', 'property']

// ✅ NEW: Database-driven
const { data } = await supabase
  .from('insurance_types')
  .select('slug, name, requires_inspection')
  .eq('is_active', true);
```

**Columns**: slug, name, description, icon, requires_inspection, typical_duration_months, is_active

---

### `moderation_rules`
**Purpose**: Out-of-scope patterns, blocked content, flagged keywords

```typescript
// ❌ OLD: Hardcoded regex array
const patterns = [/news|politics/i, /weather/i];

// ✅ NEW: Database-driven + SQL function
const { data: isOOS } = await supabase.rpc('is_query_out_of_scope', {
  p_query: userQuery
});
```

**Columns**: rule_type, pattern, description, category, severity, regex_flags, is_active

---

### `tool_enum_values`
**Purpose**: Dynamic enums for AI tool parameters

```typescript
// ❌ OLD: Hardcoded tool enum
{
  agent_id: { 
    enum: ['rides', 'jobs', 'insurance', ...]
  }
}

// ✅ NEW: Database-driven
const { data } = await supabase.rpc('get_tool_enum_values', {
  p_enum_type: 'agent_id'
});
```

**Columns**: enum_type, value, label, description, is_active, display_order, context_filter

---

## 🛠️ Helper Functions (SQL)

### `get_tool_enum_values(p_enum_type TEXT)`
Returns enum values for tool parameters.

```sql
SELECT * FROM get_tool_enum_values('agent_id');
-- Returns: value, label, description
```

### `is_query_out_of_scope(p_query TEXT)`
Checks if query matches moderation patterns.

```sql
SELECT is_query_out_of_scope('What is the weather today?');
-- Returns: true
```

### `detect_vertical_from_query(p_query TEXT)`
Detects service vertical from keywords.

```sql
SELECT detect_vertical_from_query('I need a taxi to the airport');
-- Returns: 'mobility'
```

---

## 📦 TypeScript Loader

**File**: `packages/agents/src/config/lookup-loader.ts`

```typescript
import { LookupLoader } from '@/config/lookup-loader';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const loader = new LookupLoader(supabase);

// Get all verticals
const verticals = await loader.getServiceVerticals('RW');

// Detect vertical from query
const vertical = await loader.detectVerticalFromQuery('I need a ride');

// Check if out of scope
const isOOS = await loader.isOutOfScope('What is the weather?');

// Get job categories
const categories = await loader.getJobCategories('MT');

// Get property types
const propertyTypes = await loader.getPropertyTypes();

// Get insurance types
const insuranceTypes = await loader.getInsuranceTypes();

// Get tool enum values
const agentIds = await loader.getToolEnumValues('agent_id');

// Clear cache
loader.clearCache();
```

---

## 🔄 Common Replacements

### 1. Replace Hardcoded Verticals

```diff
- import { EASYMO_VERTICALS } from './service-catalog';
+ import { LookupLoader } from './lookup-loader';
+ const loader = new LookupLoader(supabase);
+ const verticals = await loader.getServiceVerticals();
```

### 2. Replace Hardcoded Job Categories

```diff
- const CATEGORIES = ['construction', 'driving', 'retail'];
+ const categories = await loader.getJobCategories();
+ const categorySlugs = categories.map(c => c.slug);
```

### 3. Replace Out-of-Scope Patterns

```diff
- if (OUT_OF_SCOPE_PATTERNS.some(p => p.test(query))) {
+ if (await loader.isOutOfScope(query)) {
    return "I can't help with that...";
  }
```

### 4. Replace Tool Enums

```diff
- {
-   agent_id: { 
-     enum: ['rides', 'jobs', 'insurance']
-   }
- }
+ const agentIds = await loader.getToolEnumValues('agent_id');
+ {
+   agent_id: { 
+     enum: agentIds
+   }
+ }
```

---

## 📊 Data Management

### Add New Vertical

```sql
INSERT INTO service_verticals (slug, name, keywords, priority)
VALUES ('healthcare', 'Healthcare', ARRAY['doctor', 'medicine'], 13);
```

### Add New Job Category

```sql
INSERT INTO job_categories (slug, name, display_order, keywords)
VALUES ('finance', 'Finance & Accounting', 13, ARRAY['accountant', 'finance']);
```

### Add Moderation Rule

```sql
INSERT INTO moderation_rules (rule_type, pattern, category, severity)
VALUES ('blocked', 'violence|harm', 'safety', 'critical');
```

### Add Tool Enum

```sql
INSERT INTO tool_enum_values (enum_type, value, label, display_order)
VALUES ('agent_id', 'healthcare-agent', 'Healthcare Agent', 8);
```

---

## ⚡ Performance Tips

1. **Use caching**: LookupLoader caches for 5 minutes by default
2. **Load once at startup**: Initialize loader once, reuse instance
3. **Use SQL functions**: Faster than client-side regex matching
4. **Batch queries**: Load all needed data in one call

```typescript
// ❌ BAD: Multiple DB calls
const verticals = await loader.getServiceVerticals();
const categories = await loader.getJobCategories();
const types = await loader.getPropertyTypes();

// ✅ GOOD: Parallel queries
const [verticals, categories, types] = await Promise.all([
  loader.getServiceVerticals(),
  loader.getJobCategories(),
  loader.getPropertyTypes(),
]);
```

---

## 🧪 Testing

```bash
# Test migration applied
psql $DATABASE_URL -c "\dt service_verticals"

# Test data seeded
psql $DATABASE_URL -c "SELECT COUNT(*) FROM service_verticals WHERE is_active = true;"

# Test helper functions
psql $DATABASE_URL -c "SELECT detect_vertical_from_query('I need a taxi');"
psql $DATABASE_URL -c "SELECT is_query_out_of_scope('What is the weather?');"
```

---

## 🔗 Related Files

- Migration: `supabase/migrations/20251206010000_create_ai_lookup_tables.sql`
- Loader: `packages/agents/src/config/lookup-loader.ts`
- Guide: `PHASE_1_LOOKUP_TABLES_COMPLETE.md`
- Old (to delete): `packages/agents/src/config/service-catalog.ts` (after migration)

---

**Next**: Update one service to use database lookups, test, then migrate all services.
