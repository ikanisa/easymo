# Real Estate Domain Consolidation Plan

**Date:** December 10, 2025  
**Status:** 🚧 Ready for Implementation  
**Priority:** 🔴 Critical  
**Estimated Effort:** 2 days (16 hours)

## 📊 Executive Summary

The Real Estate domain has **4 separate agent implementations** that cause inconsistent behavior, confusing architecture, and maintenance overhead. This plan consolidates them into a single source of truth.

### Key Problems
- 4 different system prompts → inconsistent AI behavior
- 4 different tool sets → confusing for developers
- Hardcoded fallback data → bad user experience
- Inconsistent database column names → query failures
- Different AI models → unpredictable costs/behavior

### Solution
Consolidate into single `RealEstateAgent` class in `packages/agents/` with:
- ✅ One system prompt
- ✅ Unified tools
- ✅ Proper error handling
- ✅ Standardized database access
- ✅ Configurable model selection

## 🗂️ Current State

###Agent Implementations

1. **packages/agents/src/agents/property/real-estate.agent.ts** ✅ PRIMARY
   - 451 lines, BaseAgent extension
   - gemini-1.5-flash
   - Tools: search_listings, search_by_coordinates, deep_search
   - ⚠️ Hardcoded fallback data

2. **supabase/functions/wa-webhook/domains/ai-agents/real_estate_agent.ts** ⚠️ DUPLICATE
   - ~400 lines, Deno-based
   - Different system prompt
   - Tools: search_properties, get_property_details

3. **supabase/functions/wa-webhook/domains/property/ai_agent.ts** ⚠️ DIFFERENT PATTERN
   - ~250 lines, functional handlers
   - Functions: startPropertyAISearch, handlePropertySearchCriteria

4. **packages/ai/src/agents/openai/agent-definitions.ts** ⚠️ DIFFERENT MODEL
   - gpt-4o (vs gemini-1.5-flash)
   - Different instructions

### Shared Types ✅ EXCELLENT
- `supabase/functions/_shared/agents/real-estate/types.ts`
- 295 lines, well-documented
- Complete state machine with 20+ keys
- Proper TypeScript types
- **Action:** Use as source of truth

### Edge Functions
- `wa-webhook-property/` - ✅ Already correct, uses REAL_ESTATE_STATE_KEYS
- `agent-property-rental/` - ❓ Review usage
- `wa-webhook/domains/` - ⚠️ Update to use unified agent

## 🔴 Critical Issues

### Issue #1: Hardcoded Fallback Data
```typescript
catch (err) {
  return { 
    listings: [
      { id: '1', title: 'Cozy Apartment...', price_monthly: 300000 },
      { id: '2', title: 'Luxury Villa...', price_monthly: 1000000 }
    ]
  };
}
```
**Impact:** Users see fake data on errors  
**Fix:** Return proper error response

### Issue #2: Multiple System Prompts
Four different instruction sets:
- "You are a multilingual WhatsApp real-estate concierge..."
- "You are a multilingual real-estate concierge for Rwanda..."
- "You are the Real Estate AI Agent for EasyMO..."

**Impact:** Inconsistent AI behavior  
**Fix:** Single source of truth

### Issue #3: Database Column Inconsistency
- `property_listings.price_monthly`
- `property_listings.price`
- `listings.price_amount`

**Impact:** Query failures  
**Fix:** Standardize to `price_amount`

## 🚀 Implementation Plan

### Phase 1: Create Unified Structure (Day 1, 4 hours)

```
packages/agents/src/agents/property/
├── index.ts
├── real-estate.agent.ts        # Refactored
├── prompts/
│   └── system-prompt.ts        # Single source
├── tools/
│   ├── index.ts
│   ├── search-listings.ts
│   ├── search-by-location.ts
│   ├── deep-search.ts
│   ├── contact-owner.ts
│   └── schedule-viewing.ts
└── config.ts
```

#### Task 1.1: Extract System Prompt
```typescript
// packages/agents/src/agents/property/prompts/system-prompt.ts
export const REAL_ESTATE_SYSTEM_PROMPT = `
You are a multilingual WhatsApp real-estate concierge for EasyMO.

ROLE: Property search and rental coordinator
LANGUAGES: English, French, Kinyarwanda
MARKETS: Rwanda, Malta

CORE CAPABILITIES:
1. Property Search: Find rentals based on location, price, bedrooms
2. Deep Search: 30+ external sources (Malta: 16, Rwanda: 14)
3. Owner Communication: Contact on behalf of clients
4. Viewing Scheduling: Arrange property tours
5. Document Generation: Create property shortlists

...
`;
```

#### Task 1.2: Extract Tools
```typescript
// packages/agents/src/agents/property/tools/search-listings.ts
import type { Tool } from '../../../types/agent.types';

export const searchListingsTool: Tool = {
  type: 'function',
  function: {
    name: 'search_listings',
    description: 'Search for properties in the database',
    parameters: { /* ... */ },
    execute: async (params, context) => {
      // Unified implementation
      const { location, bedrooms, price_max } = params;
      const { supabase } = context;
      
      const { data, error } = await supabase.rpc('search_properties_unified', {
        p_location: location,
        p_bedrooms: bedrooms,
        p_price_max: price_max
      });
      
      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }
      
      return { listings: data || [], source: 'database' };
    }
  }
};
```

### Phase 2: Fix Critical Issues (Day 1, 4 hours)

#### Task 2.1: Remove Hardcoded Fallback
```typescript
// packages/agents/src/agents/property/real-estate.agent.ts
catch (err) {
  log.error({ error: err }, 'Property search failed');
  return {
    listings: [],
    error: 'Search temporarily unavailable. Please try again.',
    source: 'error'
  };
}
```

#### Task 2.2: Refactor Main Agent
```typescript
import { BaseAgent } from '../base/agent.base';
import { REAL_ESTATE_SYSTEM_PROMPT } from './prompts/system-prompt';
import { defineTools } from './tools';

export class RealEstateAgent extends BaseAgent {
  name = 'real_estate_agent';
  instructions = REAL_ESTATE_SYSTEM_PROMPT;
  model = 'gemini-1.5-flash';
  
  constructor(supabaseClient?: SupabaseClient) {
    super();
    this.supabase = supabaseClient ?? createDefaultClient();
    this.tools = defineTools(this.supabase);
  }
}
```

### Phase 3: Update Consumers (Day 2, 4 hours)

#### Task 3.1: Update wa-webhook
```typescript
// supabase/functions/wa-webhook/domains/ai-agents/real_estate_agent.ts
// Replace entire file with:
export { RealEstateAgent } from '@easymo/agents/property';
```

#### Task 3.2: Update property/ai_agent.ts
```typescript
import { RealEstateAgent } from '@easymo/agents/property';
import { REAL_ESTATE_STATE_KEYS } from '../../_shared/agents/real-estate/types.ts';

const agent = new RealEstateAgent(supabase);
// Use agent in handlers
```

#### Task 3.3: Update OpenAI Definitions
```typescript
// packages/ai/src/agents/openai/agent-definitions.ts
import { REAL_ESTATE_SYSTEM_PROMPT } from '@easymo/agents/property/prompts';

real_estate: {
  name: "Real Estate AI Agent",
  instructions: REAL_ESTATE_SYSTEM_PROMPT,
  model: "gemini-1.5-flash",
  // ...
}
```

### Phase 4: Database Standardization (Day 2, 2 hours)

```sql
-- supabase/migrations/20251211_standardize_property_columns.sql
BEGIN;

ALTER TABLE property_listings 
  ADD COLUMN IF NOT EXISTS price_amount NUMERIC(12,2);

UPDATE property_listings 
SET price_amount = COALESCE(price_monthly, price, monthly_rent)
WHERE price_amount IS NULL;

CREATE OR REPLACE FUNCTION search_properties_unified(
  p_location TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_km INTEGER DEFAULT 10,
  p_price_min NUMERIC DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_bedrooms INTEGER DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_listing_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  location TEXT,
  price_amount NUMERIC,
  bedrooms INTEGER,
  bathrooms INTEGER,
  property_type TEXT,
  listing_type TEXT,
  amenities TEXT[],
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.id, pl.title, pl.description, pl.location, pl.price_amount,
    pl.bedrooms, pl.bathrooms, pl.property_type, pl.listing_type,
    pl.amenities,
    CASE 
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
      THEN ST_Distance(
        ST_MakePoint(pl.longitude, pl.latitude)::geography,
        ST_MakePoint(p_lng, p_lat)::geography
      ) / 1000
      ELSE NULL
    END as distance_km
  FROM property_listings pl
  WHERE 
    (p_location IS NULL OR pl.location ILIKE '%' || p_location || '%')
    AND (p_price_min IS NULL OR pl.price_amount >= p_price_min)
    AND (p_price_max IS NULL OR pl.price_amount <= p_price_max)
    AND (p_bedrooms IS NULL OR pl.bedrooms = p_bedrooms)
    AND (p_property_type IS NULL OR pl.property_type = p_property_type)
    AND (p_listing_type IS NULL OR pl.listing_type = p_listing_type)
  ORDER BY 
    CASE 
      WHEN p_lat IS NOT NULL THEN distance_km
      ELSE pl.created_at
    END
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMIT;
```

### Phase 5: Clean Up (Day 2, 2 hours)

```bash
# Remove archived migrations
rm -f supabase/migrations__archive/20251122111000_apply_intent_real_estate.sql.skip
rm -f supabase/migrations__archive/20251122130000_create_jobs_and_real_estate_tables.sql.skip
rm -f supabase/migrations__archive/20251128000002_malta_real_estate_sources.sql.skip
rm -rf supabase/migrations/backup_20251114_104454/

# Move documentation
mv docs/archive/deployment/PROPERTY_RENTAL_DEEP_SEARCH.md \
   docs/features/real-estate/DEEP_SEARCH.md
```

## ✅ Success Criteria

- [ ] Single RealEstateAgent class
- [ ] All use REAL_ESTATE_STATE_KEYS
- [ ] No hardcoded fallback data
- [ ] Consistent database columns
- [ ] Unified system prompt
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Archived code removed

## 📊 Impact Assessment

| Metric | Count |
|--------|-------|
| Files to Create | 7 |
| Files to Modify | 5 |
| Files to Delete | 5 |
| Migrations | 1 |
| Tests to Update | 3 |

## 📈 Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Unified Structure | 4 hours | P0 |
| Phase 2: Fix Critical Issues | 4 hours | P0 |
| Phase 3: Update Consumers | 4 hours | P1 |
| Phase 4: Database | 2 hours | P1 |
| Phase 5: Clean Up | 2 hours | P2 |
| **Total** | **16 hours** | **2 days** |

## 🔗 Related Files

- [Real Estate Types](../../supabase/functions/_shared/agents/real-estate/types.ts)
- [Repository Cleanup](../../REPOSITORY_CLEANUP_COMPLETED.md)
- [Agents Map](../../architecture/agents-map.md)

---

**Status:** 📋 Plan Complete  
**Next:** Execute Phase 1  
**Target:** December 11-12, 2025
