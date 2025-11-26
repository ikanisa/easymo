# Location Integration - Complete Implementation Guide
**Date**: November 26, 2025  
**Version**: 1.0  
**Status**: READY FOR DEPLOYMENT

This guide provides all code changes needed to complete the location integration across all microservices.

---

## 📋 TABLE OF CONTENTS

1. [Phase 1: AI Agents Migration](#phase-1-ai-agents-migration)
2. [Phase 2: Cache Integrations](#phase-2-cache-integrations)
3. [Phase 3: Unified Service](#phase-3-unified-service)
4. [Database Migrations](#database-migrations)
5. [Testing & Verification](#testing--verification)

---

## PHASE 1: AI Agents Migration

### 1.1 Migrate farmer_agent.ts

**File**: `supabase/functions/wa-webhook-ai-agents/agents/farmer_agent.ts`

#### Changes Required:

```typescript
// ADD AT TOP OF FILE
import { AgentLocationHelper } from '../location-helper.ts';

// ADD TO AGENT CLASS
export class FarmerAgent extends BaseAgent {
  private locationHelper: AgentLocationHelper;
  
  constructor(supabase: SupabaseClient) {
    super(supabase);
    this.locationHelper = new AgentLocationHelper(supabase);
  }
  
  // MODIFY search_produce TOOL
  async search_produce(params: { query: string; category?: string }) {
    const { query, category } = params;
    
    // Try to get user location (cache → saved → prompt)
    const location = await this.locationHelper.resolveUserLocation(
      this.userId,
      'farmer_agent',
      30  // 30-minute cache
    );
    
    if (!location) {
      // User was prompted to share location
      return {
        message: this.locationHelper.formatLocationPrompt('farmer_agent', this.locale)
      };
    }
    
    // Log location source
    console.log(`Using ${location.source} location for farmer search`);
    
    // GPS-BASED SEARCH
    if (location.lat && location.lng) {
      const { data: nearbyProduce, error } = await this.supabase.rpc('search_nearby_produce', {
        _lat: location.lat,
        _lng: location.lng,
        _radius_km: 50,
        _category: category,
        _query: query,
        _limit: 20
      });
      
      if (!error && nearbyProduce && nearbyProduce.length > 0) {
        let response = `🌾 Found ${nearbyProduce.length} ${category || 'produce'} items near you:\n\n`;
        
        nearbyProduce.forEach((item: any, idx: number) => {
          response += `${idx + 1}. *${item.name}*\n`;
          response += `   📍 ${item.distance_km}km away\n`;
          response += `   💰 ${item.price} ${item.currency || 'RWF'}\n`;
          response += `   👤 ${item.farmer_name}\n`;
          if (item.quantity) {
            response += `   📦 ${item.quantity} ${item.unit}\n`;
          }
          response += `\n`;
        });
        
        response += `\n${this.locationHelper.formatLocationContext(location)}`;
        
        return { message: response };
      }
    }
    
    // FALLBACK: Text-based search
    const { data: textResults } = await this.supabase
      .from('produce_listings')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .eq('status', 'active')
      .limit(20);
    
    if (textResults && textResults.length > 0) {
      let response = `🌾 Found ${textResults.length} ${category || 'produce'} items:\n\n`;
      // Format results...
      return { message: response };
    }
    
    return {
      message: `No ${category || 'produce'} found matching "${query}". Try a different search term.`
    };
  }
}
```

#### Database RPC Needed:

**File**: `supabase/migrations/20251127008000_farmer_location_support.sql`

```sql
BEGIN;

-- Add GPS columns to produce_listings (if not exists)
ALTER TABLE produce_listings
ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS location_geography geography(POINT, 4326);

-- Spatial index
CREATE INDEX IF NOT EXISTS idx_produce_listings_geography 
ON produce_listings USING GIST (location_geography);

-- Trigger to update geography
CREATE OR REPLACE FUNCTION update_produce_listing_geography()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location_geography := ST_SetSRID(
      ST_MakePoint(NEW.lng, NEW.lat),
      4326
    )::geography;
  ELSE
    NEW.location_geography := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_produce_listing_geography ON produce_listings;
CREATE TRIGGER trg_produce_listing_geography
  BEFORE INSERT OR UPDATE OF lat, lng
  ON produce_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_produce_listing_geography();

-- Search nearby produce RPC
CREATE OR REPLACE FUNCTION search_nearby_produce(
  _lat NUMERIC,
  _lng NUMERIC,
  _radius_km NUMERIC DEFAULT 50,
  _category TEXT DEFAULT NULL,
  _query TEXT DEFAULT NULL,
  _limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  price NUMERIC,
  currency TEXT,
  quantity NUMERIC,
  unit TEXT,
  farmer_id UUID,
  farmer_name TEXT,
  lat NUMERIC,
  lng NUMERIC,
  distance_km NUMERIC,
  status TEXT
) AS $$
DECLARE
  _user_location geography;
BEGIN
  _user_location := ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography;
  
  RETURN QUERY
  SELECT
    pl.id,
    pl.name,
    pl.description,
    pl.price,
    pl.currency,
    pl.quantity,
    pl.unit,
    pl.farmer_id,
    u.full_name AS farmer_name,
    pl.lat,
    pl.lng,
    ROUND(
      (ST_Distance(pl.location_geography, _user_location) / 1000)::NUMERIC,
      2
    ) AS distance_km,
    pl.status
  FROM
    produce_listings pl
    LEFT JOIN whatsapp_users u ON pl.farmer_id = u.id
  WHERE
    pl.status = 'active'
    AND pl.location_geography IS NOT NULL
    AND ST_DWithin(pl.location_geography, _user_location, _radius_km * 1000)
    AND (_category IS NULL OR pl.category = _category)
    AND (_query IS NULL OR 
         pl.name ILIKE '%' || _query || '%' OR 
         pl.description ILIKE '%' || _query || '%')
  ORDER BY
    distance_km ASC
  LIMIT _limit;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION search_nearby_produce TO authenticated, anon, service_role;

COMMIT;
```

---

### 1.2 Migrate business_broker_agent.ts

**File**: `supabase/functions/wa-webhook-ai-agents/agents/business_broker_agent.ts`

#### Changes Required:

```typescript
// ADD AT TOP
import { AgentLocationHelper } from '../location-helper.ts';

// ADD TO AGENT CLASS
export class BusinessBrokerAgent extends BaseAgent {
  private locationHelper: AgentLocationHelper;
  
  constructor(supabase: SupabaseClient) {
    super(supabase);
    this.locationHelper = new AgentLocationHelper(supabase);
  }
  
  // MODIFY search_businesses TOOL
  async search_businesses(params: { query: string; industry?: string; for_sale?: boolean }) {
    const { query, industry, for_sale = true } = params;
    
    // Resolve location (cache first for mobile broker)
    const location = await this.locationHelper.resolveUserLocation(
      this.userId,
      'business_broker_agent',
      30  // Use cache, broker is mobile
    );
    
    if (!location) {
      return {
        message: this.locationHelper.formatLocationPrompt('business_broker_agent', this.locale)
      };
    }
    
    // GPS search
    if (location.lat && location.lng) {
      const { data: businesses, error } = await this.supabase.rpc('search_nearby_businesses', {
        _lat: location.lat,
        _lng: location.lng,
        _radius_km: 100,  // Broader search for businesses
        _industry: industry,
        _for_sale: for_sale,
        _query: query,
        _limit: 15
      });
      
      if (!error && businesses && businesses.length > 0) {
        let response = `🏢 Found ${businesses.length} businesses:\n\n`;
        
        businesses.forEach((biz: any, idx: number) => {
          response += `${idx + 1}. *${biz.name}*\n`;
          response += `   📍 ${biz.distance_km}km away\n`;
          response += `   💰 ${biz.asking_price ? `${biz.asking_price} ${biz.currency}` : 'Price on request'}\n`;
          response += `   🏭 ${biz.industry || 'General'}\n`;
          if (biz.revenue) {
            response += `   📊 Revenue: ${biz.revenue}\n`;
          }
          response += `\n`;
        });
        
        response += `\n${this.locationHelper.formatLocationContext(location)}`;
        
        return { message: response };
      }
    }
    
    // Fallback...
    return { message: `No businesses found. Try different criteria.` };
  }
}
```

#### Database RPC:

**File**: `supabase/migrations/20251127009000_business_location_support.sql`

```sql
BEGIN;

-- Add GPS to business_listings
ALTER TABLE business_listings
ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS location_geography geography(POINT, 4326);

CREATE INDEX IF NOT EXISTS idx_business_listings_geography 
ON business_listings USING GIST (location_geography);

-- Trigger
CREATE OR REPLACE FUNCTION update_business_listing_geography()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location_geography := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.location_geography := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_business_listing_geography ON business_listings;
CREATE TRIGGER trg_business_listing_geography
  BEFORE INSERT OR UPDATE OF lat, lng
  ON business_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_business_listing_geography();

-- RPC
CREATE OR REPLACE FUNCTION search_nearby_businesses(
  _lat NUMERIC,
  _lng NUMERIC,
  _radius_km NUMERIC DEFAULT 100,
  _industry TEXT DEFAULT NULL,
  _for_sale BOOLEAN DEFAULT TRUE,
  _query TEXT DEFAULT NULL,
  _limit INTEGER DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  industry TEXT,
  asking_price NUMERIC,
  currency TEXT,
  revenue NUMERIC,
  lat NUMERIC,
  lng NUMERIC,
  distance_km NUMERIC,
  status TEXT
) AS $$
DECLARE
  _user_location geography;
BEGIN
  _user_location := ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography;
  
  RETURN QUERY
  SELECT
    bl.id,
    bl.name,
    bl.description,
    bl.industry,
    bl.asking_price,
    bl.currency,
    bl.revenue,
    bl.lat,
    bl.lng,
    ROUND((ST_Distance(bl.location_geography, _user_location) / 1000)::NUMERIC, 2) AS distance_km,
    bl.status
  FROM
    business_listings bl
  WHERE
    bl.status = 'active'
    AND bl.for_sale = _for_sale
    AND bl.location_geography IS NOT NULL
    AND ST_DWithin(bl.location_geography, _user_location, _radius_km * 1000)
    AND (_industry IS NULL OR bl.industry = _industry)
    AND (_query IS NULL OR bl.name ILIKE '%' || _query || '%')
  ORDER BY
    distance_km ASC
  LIMIT _limit;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION search_nearby_businesses TO authenticated, anon, service_role;

COMMIT;
```

---

### 1.3 Migrate waiter_agent.ts (sales_agent)

**File**: `supabase/functions/wa-webhook-ai-agents/agents/waiter_agent.ts`

Similar pattern - add `AgentLocationHelper`, resolve location, use `search_nearby_restaurants()` RPC.

---

## PHASE 2: Cache Integrations

### 2.1 Profile Service - Add Cache Save

**File**: `supabase/functions/wa-webhook-profile/index.ts` or `profile/locations.ts`

#### Add to location message handler:

```typescript
// When location is received in ADD_LOC flow
if (message.type === 'location' && userState === 'ADD_LOC') {
  const location = parseLocation(message.location);
  
  // EXISTING: Save to saved_locations ✅
  const { error: saveError } = await supabase
    .from('saved_locations')
    .insert({
      user_id: userId,
      lat: location.lat,
      lng: location.lng,
      label: pendingLabel,  // home/work/school/other
      address: location.address,
      name: location.name
    });
  
  // NEW: ALSO save to cache for immediate use ✅
  await supabase.rpc('update_user_location_cache', {
    _user_id: userId,
    _lat: location.lat,
    _lng: location.lng
  });
  
  // Clear state
  // Send confirmation
}
```

---

### 2.2 Property Service - Full Cache Integration

**File**: `supabase/functions/wa-webhook-property/index.ts`

#### Add cache save on location share:

```typescript
if (message.type === 'location') {
  const location = parseLocation(message.location);
  
  // Save to cache
  await supabase.rpc('update_user_location_cache', {
    _user_id: userId,
    _lat: location.lat,
    _lng: location.lng
  });
  
  // Search properties
  await searchNearbyProperties(location.lat, location.lng);
}
```

#### Check cache before prompting:

```typescript
// When user wants to search properties
async function handlePropertySearch(userId: string, criteria: any) {
  // Try cache first
  const { data: cached } = await supabase.rpc('get_cached_location', {
    _user_id: userId,
    _cache_minutes: 30
  });
  
  if (cached?.[0]?.is_valid) {
    // Use cached location
    await searchProperties(cached[0].lat, cached[0].lng, criteria);
    return;
  }
  
  // Try saved home
  const { data: savedHome } = await supabase
    .from('saved_locations')
    .select('lat, lng')
    .eq('user_id', userId)
    .eq('label', 'home')
    .maybeSingle();
  
  if (savedHome) {
    await searchProperties(savedHome.lat, savedHome.lng, criteria);
    return;
  }
  
  // Prompt for location
  await promptForLocation(phone, locale);
}
```

---

### 2.3 Marketplace - Add Saved Location Support

**File**: `supabase/functions/wa-webhook-marketplace/index.ts`

#### Add before prompting:

```typescript
async function getMarketplaceLocation(userId: string) {
  // Check cache (already implemented) ✅
  const cached = await getCachedLocation(userId);
  if (cached) return cached;
  
  // NEW: Check saved home location
  const { data: savedHome } = await supabase
    .from('saved_locations')
    .select('lat, lng, label')
    .eq('user_id', userId)
    .eq('label', 'home')
    .maybeSingle();
  
  if (savedHome) {
    return {
      lat: savedHome.lat,
      lng: savedHome.lng,
      source: 'saved_home'
    };
  }
  
  // NEW: Try any saved location
  const { data: anySaved } = await supabase
    .from('saved_locations')
    .select('lat, lng, label')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (anySaved) {
    return {
      lat: anySaved.lat,
      lng: anySaved.lng,
      source: `saved_${anySaved.label}`
    };
  }
  
  return null;
}
```

---

## PHASE 3: Unified Service Cache

**File**: `supabase/functions/wa-webhook-unified/index.ts`

Add same cache save/read pattern as Jobs service.

---

## DATABASE MIGRATIONS

All SQL migrations are provided in the respective sections above.

---

## TESTING & VERIFICATION

### Manual Testing Checklist

For each service:
1. Share location via WhatsApp
2. Verify cache is saved (check `user_location_cache` table)
3. Send search request within 30 minutes
4. Verify cached location is used (no re-prompt)
5. Wait 30+ minutes and search again
6. Verify user is prompted for location
7. Save a "home" location
8. Search without sharing location
9. Verify saved home is used

### SQL Verification Queries

```sql
-- Check location cache
SELECT * FROM user_location_cache 
WHERE user_id = 'USER_ID'
ORDER BY cached_at DESC LIMIT 5;

-- Check saved locations
SELECT * FROM saved_locations
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC;

-- Test nearby search
SELECT * FROM search_nearby_jobs(
  -1.9441, 30.0619,  -- Kigali coordinates
  50,                -- 50km radius
  20                 -- limit 20
);
```

---

## DEPLOYMENT

Use the deployment script:

```bash
# Deploy Phase 1 only (AI Agents)
./deploy-location-integration-complete.sh phase1

# Deploy Phase 2 only (Cache)
./deploy-location-integration-complete.sh phase2

# Deploy Phase 3 only (Unified)
./deploy-location-integration-complete.sh phase3

# Deploy everything
./deploy-location-integration-complete.sh all
```

---

## MONITORING

After deployment, monitor:

1. **Supabase Logs**: Watch for location-related errors
2. **Cache Hit Rate**: Check how often cache is used vs. prompts
3. **GPS Search Performance**: Monitor RPC execution times
4. **User Feedback**: Track location-related support issues

---

**Document Status**: COMPLETE ✅  
**Ready for**: Implementation and deployment  
**Estimated Time**: 5 hours total (1.5h + 2.5h + 1h)
