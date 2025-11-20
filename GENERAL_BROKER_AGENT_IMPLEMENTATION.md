# General Broker Agent - Deep Implementation Review & Update

## Executive Summary

This document provides a comprehensive review of the current General Broker Agent implementation and a detailed plan to align it with the full EasyMO-centric blueprint.

---

## Current State Analysis

### ✅ What's Already Implemented

1. **Agent Definition** (`packages/agents/src/agents/general/general-broker.agent.ts`)
   - Proper scope enforcement (EasyMO services only)
   - Out-of-scope message handling
   - Service catalog integration
   - Basic routing instructions
   - menuLookupTool integration

2. **Service Catalog** (`packages/agents/src/config/service-catalog.ts`)
   - All 12 EasyMO verticals defined
   - Keyword-based intent detection
   - Multilingual out-of-scope messages (EN/FR/RW/SW/LN)
   - Pattern matching for out-of-scope topics

3. **Router Integration** (`supabase/functions/wa-webhook/router/`)
   - Text message handling
   - AI agent handler with orchestrator
   - Rate limiting
   - Metrics tracking
   - Template-based delivery

### ❌ What's Missing (Critical Gaps)

1. **Database Schema**: No tables for:
   - `user_locations` (saved home/work/school)
   - `user_facts` (persistent key-value memory)
   - `service_requests` (unified structured memory)
   - `vendors` (unified vendor registry)
   - `vendor_capabilities` (vendor service offerings)

2. **Tools/Functions**: Missing edge functions for:
   - `get_user_locations`
   - `upsert_user_location`
   - `get_user_facts` / `upsert_user_fact`
   - `classify_request`
   - `record_service_request`
   - `update_service_request`
   - `find_vendors_nearby`
   - `search_service_catalog`
   - `search_easymo_faq`
   - `route_to_agent`

3. **Agent Orchestrator Integration**: 
   - General Broker not explicitly registered in orchestrator
   - Missing intent classification for broker vs specialized agents

4. **WhatsApp Flows**:
   - No vendor onboarding flow
   - No location capture/reuse flow
   - Limited commerce flow (scattered across pharmacy/quincaillerie)

5. **Voice/Call Support**:
   - No SIP trunk integration
   - No voice note STT → broker flow
   - No TTS for voice responses

6. **Admin UI**:
   - No "Service Requests" dashboard
   - No "Vendors" management page
   - No "EasyMO Service Catalog" CMS

---

## Implementation Plan

### Phase 1: Database Schema (Priority: CRITICAL)

#### Migration 1: User Memory Tables

```sql
-- File: supabase/migrations/20251120100000_general_broker_user_memory.sql

BEGIN;

-- User locations for saved places
CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT CHECK (label IN ('home','work','school','other')) DEFAULT 'other',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX idx_user_locations_default ON public.user_locations(user_id, is_default) WHERE is_default = TRUE;

-- User facts for persistent memory
CREATE TABLE IF NOT EXISTS public.user_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, key)
);

CREATE INDEX idx_user_facts_user_id ON public.user_facts(user_id);
CREATE INDEX idx_user_facts_key ON public.user_facts(user_id, key);

-- RLS Policies
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_locations_select" ON public.user_locations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_locations_insert" ON public.user_locations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_locations_update" ON public.user_locations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "user_facts_select" ON public.user_facts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_facts_insert" ON public.user_facts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_facts_update" ON public.user_facts
  FOR UPDATE USING (user_id = auth.uid());

COMMIT;
```

#### Migration 2: Service Requests

```sql
-- File: supabase/migrations/20251120100001_general_broker_service_requests.sql

BEGIN;

-- Unified service request tracking across all verticals
CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Classification
  vertical TEXT CHECK (vertical IN (
    'mobility','commerce','hospitality','insurance','property',
    'legal','jobs','farming','marketing','sora_video','support'
  )) NOT NULL,
  request_type TEXT NOT NULL,  -- 'buy', 'book', 'quote', 'consult', 'post_job', 'onboard_vendor'
  category TEXT,               -- Vertical-specific: 'electronics', 'motor_insurance', etc.
  subcategory TEXT,            -- 'laptop', 'motor_third_party', etc.
  
  -- Details
  title TEXT,
  description TEXT,
  
  -- Location
  location_id UUID REFERENCES public.user_locations(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  
  -- Flexible payload per vertical
  payload JSONB DEFAULT '{}'::jsonb,
  
  -- Status tracking
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','fulfilled','cancelled')),
  
  -- Source & timestamps
  source TEXT DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

CREATE INDEX idx_service_requests_user_id ON public.service_requests(user_id);
CREATE INDEX idx_service_requests_org_id ON public.service_requests(org_id);
CREATE INDEX idx_service_requests_vertical ON public.service_requests(vertical);
CREATE INDEX idx_service_requests_status ON public.service_requests(status);
CREATE INDEX idx_service_requests_created_at ON public.service_requests(created_at DESC);

-- RLS
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_requests_select" ON public.service_requests
  FOR SELECT USING (
    user_id = auth.uid() OR 
    org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "service_requests_insert" ON public.service_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_requests_update" ON public.service_requests
  FOR UPDATE USING (
    user_id = auth.uid() OR 
    org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  );

COMMIT;
```

#### Migration 3: Vendors & Capabilities

```sql
-- File: supabase/migrations/20251120100002_general_broker_vendors.sql

BEGIN;

-- Unified vendor registry (cross-vertical)
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id),
  
  -- Basic info
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp_number TEXT,
  email TEXT,
  
  -- Location
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  city TEXT,
  country TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  verified BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor capabilities per vertical
CREATE TABLE IF NOT EXISTS public.vendor_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  
  vertical TEXT NOT NULL CHECK (vertical IN (
    'mobility','commerce','hospitality','insurance','property',
    'legal','jobs','farming','marketing','sora_video'
  )),
  category TEXT NOT NULL,       -- 'electronics', 'restaurant', 'motor_insurance'
  subcategories TEXT[] DEFAULT '{}'::text[],
  tags TEXT[] DEFAULT '{}'::text[],
  
  -- Service-specific metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendors_location ON public.vendors USING GIST (
  ll_to_earth(latitude, longitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_vendors_active ON public.vendors(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_vendor_capabilities_vertical ON public.vendor_capabilities(vertical);
CREATE INDEX idx_vendor_capabilities_vendor_id ON public.vendor_capabilities(vendor_id);

-- RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_select" ON public.vendors FOR SELECT USING (TRUE);
CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT WITH CHECK (
  org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
);
CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE USING (
  org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
);

CREATE POLICY "vendor_capabilities_select" ON public.vendor_capabilities FOR SELECT USING (TRUE);
CREATE POLICY "vendor_capabilities_insert" ON public.vendor_capabilities FOR INSERT WITH CHECK (
  vendor_id IN (SELECT id FROM public.vendors WHERE org_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  ))
);

COMMIT;
```

#### Migration 4: Service Catalog & FAQ

```sql
-- File: supabase/migrations/20251120100003_general_broker_catalog_faq.sql

BEGIN;

-- EasyMO service catalog (for agent discovery)
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  docs_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ for EasyMO platform questions
CREATE TABLE IF NOT EXISTS public.faq_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  locale TEXT DEFAULT 'en' CHECK (locale IN ('en','fr','rw','sw','ln')),
  tags TEXT[] DEFAULT '{}'::text[],
  vertical TEXT,  -- Optional: link to a specific vertical
  views_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_faq_locale ON public.faq_articles(locale);
CREATE INDEX idx_faq_tags ON public.faq_articles USING GIN(tags);
CREATE INDEX idx_faq_active ON public.faq_articles(is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_catalog_select" ON public.service_catalog FOR SELECT USING (enabled = TRUE);
CREATE POLICY "faq_articles_select" ON public.faq_articles FOR SELECT USING (is_active = TRUE);

-- Admin policies (requires staff role check - adjust based on your auth)
CREATE POLICY "service_catalog_admin" ON public.service_catalog FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);
CREATE POLICY "faq_articles_admin" ON public.faq_articles FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

COMMIT;
```

### Phase 2: Edge Functions (Tools)

#### Tool 1: User Location Tools

```typescript
// File: supabase/functions/agent-tools-location/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { action, userId, ...params } = await req.json();
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (action) {
      case "get_user_locations":
        return await getUserLocations(supabase, userId);
      case "upsert_user_location":
        return await upsertUserLocation(supabase, userId, params);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

async function getUserLocations(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_locations")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (error) throw error;
  return new Response(JSON.stringify({ locations: data }), { status: 200 });
}

async function upsertUserLocation(supabase: any, userId: string, params: any) {
  const { label, latitude, longitude, address, isDefault } = params;

  // If setting as default, unset others first
  if (isDefault) {
    await supabase
      .from("user_locations")
      .update({ is_default: false })
      .eq("user_id", userId);
  }

  const { data, error } = await supabase
    .from("user_locations")
    .upsert({
      user_id: userId,
      label,
      latitude,
      longitude,
      address,
      is_default: isDefault || false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return new Response(JSON.stringify({ location: data }), { status: 200 });
}
```

#### Tool 2: Service Request Tools

```typescript
// File: supabase/functions/agent-tools-service-requests/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { action, userId, ...params } = await req.json();
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (action) {
      case "classify_request":
        return await classifyRequest(params.query);
      case "record_service_request":
        return await recordServiceRequest(supabase, userId, params);
      case "update_service_request":
        return await updateServiceRequest(supabase, params);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

async function classifyRequest(query: string) {
  // Simple keyword-based classification (enhance with LLM if needed)
  const vertical = detectVertical(query);
  const requestType = detectRequestType(query);
  
  return new Response(JSON.stringify({ vertical, requestType }), { status: 200 });
}

async function recordServiceRequest(supabase: any, userId: string, params: any) {
  const { orgId, vertical, requestType, category, subcategory, title, description, locationId, payload } = params;

  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      org_id: orgId,
      user_id: userId,
      vertical,
      request_type: requestType,
      category,
      subcategory,
      title,
      description,
      location_id: locationId,
      payload: payload || {},
      status: "open",
    })
    .select()
    .single();

  if (error) throw error;
  return new Response(JSON.stringify({ serviceRequest: data }), { status: 200 });
}

async function updateServiceRequest(supabase: any, params: any) {
  const { id, patch } = params;

  const { data, error } = await supabase
    .from("service_requests")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return new Response(JSON.stringify({ serviceRequest: data }), { status: 200 });
}

function detectVertical(query: string): string | null {
  // Import from service catalog (simplified here)
  if (/laptop|shop|buy|cement/.test(query.toLowerCase())) return "commerce";
  if (/insurance|policy/.test(query.toLowerCase())) return "insurance";
  if (/house|rent|property/.test(query.toLowerCase())) return "property";
  // ... etc
  return null;
}

function detectRequestType(query: string): string {
  if (/buy|purchase/.test(query.toLowerCase())) return "buy";
  if (/book|reserve/.test(query.toLowerCase())) return "book";
  if (/quote|price/.test(query.toLowerCase())) return "quote";
  return "general";
}
```

#### Tool 3: Vendor Search

```typescript
// File: supabase/functions/agent-tools-vendors/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { action, ...params } = await req.json();
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (action) {
      case "find_vendors_nearby":
        return await findVendorsNearby(supabase, params);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

async function findVendorsNearby(supabase: any, params: any) {
  const { vertical, category, latitude, longitude, radiusKm = 10, limit = 10 } = params;

  // Use PostGIS for geospatial query
  const { data, error } = await supabase.rpc("vendors_nearby", {
    p_vertical: vertical,
    p_category: category,
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_km: radiusKm,
    p_limit: limit,
  });

  if (error) throw error;
  return new Response(JSON.stringify({ vendors: data }), { status: 200 });
}
```

Add the PostgreSQL function:

```sql
-- Add to migration: 20251120100002_general_broker_vendors.sql

CREATE OR REPLACE FUNCTION vendors_nearby(
  p_vertical TEXT,
  p_category TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 10,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  whatsapp_number TEXT,
  address TEXT,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.name,
    v.whatsapp_number,
    v.address,
    earth_distance(
      ll_to_earth(v.latitude, v.longitude),
      ll_to_earth(p_latitude, p_longitude)
    ) / 1000.0 AS distance_km
  FROM public.vendors v
  INNER JOIN public.vendor_capabilities vc ON v.id = vc.vendor_id
  WHERE v.is_active = TRUE
    AND vc.vertical = p_vertical
    AND (p_category IS NULL OR vc.category = p_category)
    AND earth_distance(
      ll_to_earth(v.latitude, v.longitude),
      ll_to_earth(p_latitude, p_longitude)
    ) <= p_radius_km * 1000
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Phase 3: Update General Broker Agent

Enhanced agent with all tools:

```typescript
// File: packages/agents/src/agents/general/general-broker.agent.ts (UPDATE)

import { getAvailableServices, getOutOfScopeMessage } from '../../config/service-catalog';
import type { AgentDefinition } from '../../runner';
import { 
  menuLookupTool,
  userLocationTool,
  userFactsTool,
  serviceRequestTool,
  vendorSearchTool,
  catalogSearchTool,
  routeToAgentTool
} from '../../tools';
import type { AgentContext } from '../../types';

export const GeneralBrokerAgent: AgentDefinition = {
  name: 'GeneralBrokerAgent',
  instructions: `[Keep existing instructions from current implementation, enhanced with:]

**TOOLS USAGE:**
1. **Location**: Always check get_user_locations first. If user has a default location, use it silently.
2. **Memory**: Use get_user_facts to avoid re-asking stored preferences (language, budget, etc).
3. **Service Requests**: For every meaningful user ask, call record_service_request to create structured memory.
4. **Vendors**: Use find_vendors_nearby to get EasyMO-registered vendors only. Never invent vendors.
5. **Routing**: When routing to a specialist, call route_to_agent to update conversation state.
6. **FAQ**: Use search_easymo_faq for platform questions, search_service_catalog for service info.

**CONCISE FLOW:**
- Max 2 short messages per turn
- Ask only missing required fields
- Reuse stored data aggressively
- Provide max 3 vendor recommendations
- Route quickly to specialists when identified

${getAvailableServices()}`,
  
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 500,
  
  tools: [
    menuLookupTool,
    userLocationTool,
    userFactsTool,
    serviceRequestTool,
    vendorSearchTool,
    catalogSearchTool,
    routeToAgentTool
  ],
};
```

### Phase 4: Router Integration

Update text router to prioritize General Broker for unhandled messages:

```typescript
// File: supabase/functions/wa-webhook/router/text.ts (UPDATE - at end before sendHomeMenu)

// NEW: General Broker AI fallback
if (await tryGeneralBrokerAgent(ctx, body, state)) {
  return true;
}

// Existing fallback
await sendHomeMenu(ctx);
return true;
```

Add handler:

```typescript
async function tryGeneralBrokerAgent(
  ctx: RouterContext,
  body: string,
  state: ChatState
): Promise<boolean> {
  try {
    // Check if message should go to General Broker
    if (isOutOfScope(body)) {
      // Send out-of-scope message
      await sendText(ctx.from, getOutOfScopeMessage(ctx.locale));
      return true;
    }

    // Detect vertical
    const vertical = detectVerticalFromQuery(body);
    if (!vertical) {
      // General inquiry - route to broker
      const { runGeneralBrokerAgent } = await import("../domains/ai-agents/general-broker.ts");
      return await runGeneralBrokerAgent(ctx, body, state);
    }

    // Has vertical - broker should handle and potentially route
    const { runGeneralBrokerAgent } = await import("../domains/ai-agents/general-broker.ts");
    return await runGeneralBrokerAgent(ctx, body, state);
    
  } catch (error) {
    console.error("General Broker error:", error);
    return false;
  }
}
```

### Phase 5: Admin UI (Next Steps)

1. **Service Requests Dashboard** (admin-app/app/service-requests/page.tsx)
2. **Vendors Management** (admin-app/app/vendors/page.tsx)
3. **Service Catalog CMS** (admin-app/app/catalog/page.tsx)
4. **FAQ Management** (admin-app/app/faq/page.tsx)

---

## Rollout Plan

### Week 1: Database & Core Tools
- [ ] Create all 4 migrations
- [ ] Test migrations locally
- [ ] Deploy to staging
- [ ] Create 3 edge functions (location, service-requests, vendors)
- [ ] Test tools with Postman

### Week 2: Agent Enhancement
- [ ] Update General Broker agent with all tools
- [ ] Register in orchestrator
- [ ] Add intent classification
- [ ] Test end-to-end flows (commerce, insurance, property)

### Week 3: Router & Flows
- [ ] Update text router
- [ ] Add vendor onboarding flow
- [ ] Add location capture flow
- [ ] Test WhatsApp integration

### Week 4: Admin UI
- [ ] Build Service Requests page
- [ ] Build Vendors page
- [ ] Build Catalog/FAQ CMS
- [ ] Staff training

---

## Success Metrics

1. **Scope Compliance**: <1% out-of-scope answers
2. **Service Request Creation**: 100% of meaningful asks create a row
3. **Location Reuse**: >80% of requests use saved location
4. **Vendor Accuracy**: 0% invented vendors, all from DB
5. **Response Time**: <3s average
6. **Routing Accuracy**: >90% correct specialist selection

---

## Next Actions

1. Review and approve this plan
2. Create migrations in order
3. Build and test tools one by one
4. Update agent definition
5. Integration testing
6. Production rollout

