# Admin API Consolidation - Implementation Guide

**Date:** December 10, 2025  
**Target:** Consolidate 6 admin functions into 1 unified API  
**Savings:** 5 functions (6 → 1)  
**Risk:** LOW  
**Effort:** 2-3 days

---

## 🎯 Objective

Consolidate these admin functions:

- `admin-health` - System health checks
- `admin-messages` - Message management
- `admin-settings` - Settings management
- `admin-stats` - Statistics/analytics
- `admin-users` - User management
- `admin-trips` - Trip management (mobility-specific)

Into a single unified `admin-api` with route-based handlers.

---

## 📋 Implementation Plan

### Step 1: Create Structure (30 mins)

```bash
cd supabase/functions
mkdir -p admin-api/routes
mkdir -p admin-api/middleware
mkdir -p admin-api/utils
```

### Step 2: Create Route Handlers (2-3 hours)

#### routes/health.ts

```typescript
// Copy from admin-health/index.ts, extract handler logic
import { SupabaseClient } from "@supabase/supabase-js";

export async function handleHealth(_req: Request, supabase: SupabaseClient): Promise<Response> {
  // Check database connection
  const { error } = await supabase.from("profiles").select("count").limit(1);

  const health = {
    status: error ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: error ? "down" : "up",
    },
  };

  return new Response(JSON.stringify(health), {
    headers: { "Content-Type": "application/json" },
    status: error ? 503 : 200,
  });
}
```

#### routes/messages.ts

```typescript
// Copy from admin-messages/index.ts, extract handler logic
export async function handleMessages(req: Request, supabase: SupabaseClient): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  if (method === "GET") {
    // List messages logic from admin-messages
    return await listMessages(req, supabase);
  } else if (method === "POST") {
    // Create message logic
    return await createMessage(req, supabase);
  } else if (method === "DELETE") {
    // Delete message logic
    return await deleteMessage(req, supabase);
  }

  return new Response("Method not allowed", { status: 405 });
}
```

#### routes/settings.ts

```typescript
// Copy from admin-settings/index.ts
export async function handleSettings(req: Request, supabase: SupabaseClient): Promise<Response> {
  // Settings CRUD logic from admin-settings
}
```

#### routes/stats.ts

```typescript
// Copy from admin-stats/index.ts
export async function handleStats(req: Request, supabase: SupabaseClient): Promise<Response> {
  // Statistics aggregation logic from admin-stats
}
```

#### routes/users.ts

```typescript
// Copy from admin-users/index.ts
export async function handleUsers(req: Request, supabase: SupabaseClient): Promise<Response> {
  // User management logic from admin-users
}
```

#### routes/trips.ts

```typescript
// Copy from admin-trips/index.ts
export async function handleTrips(req: Request, supabase: SupabaseClient): Promise<Response> {
  // Trip management logic from admin-trips (mobility)
}
```

---

### Step 3: Create Main Handler (1 hour)

#### index.ts

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleHealth } from "./routes/health.ts";
import { handleMessages } from "./routes/messages.ts";
import { handleSettings } from "./routes/settings.ts";
import { handleStats } from "./routes/stats.ts";
import { handleUsers } from "./routes/users.ts";
import { handleTrips } from "./routes/trips.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Parse route from URL
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const route = pathParts[pathParts.length - 1]; // Last part after /admin-api/

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Route to appropriate handler
    let response: Response;

    switch (route) {
      case "health":
        response = await handleHealth(req, supabase);
        break;
      case "messages":
        response = await handleMessages(req, supabase);
        break;
      case "settings":
        response = await handleSettings(req, supabase);
        break;
      case "stats":
        response = await handleStats(req, supabase);
        break;
      case "users":
        response = await handleUsers(req, supabase);
        break;
      case "trips":
        response = await handleTrips(req, supabase);
        break;
      default:
        response = new Response(
          JSON.stringify({
            error: "Route not found",
            available: ["health", "messages", "settings", "stats", "users", "trips"],
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
    }

    // Add CORS headers to response
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

#### function.json

```json
{
  "verify_jwt": true
}
```

#### deno.json

```json
{
  "imports": {
    "supabase": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

---

### Step 4: Testing (4-6 hours)

#### Local Testing

```bash
# Start Supabase locally
supabase start

# Test each route
supabase functions serve admin-api

# Health check
curl http://localhost:54321/functions/v1/admin-api/health

# Messages
curl http://localhost:54321/functions/v1/admin-api/messages

# Settings
curl http://localhost:54321/functions/v1/admin-api/settings

# Stats
curl http://localhost:54321/functions/v1/admin-api/stats

# Users
curl http://localhost:54321/functions/v1/admin-api/users

# Trips
curl http://localhost:54321/functions/v1/admin-api/trips
```

#### Integration Testing

```bash
# Test with actual auth tokens
# Test POST/PUT/DELETE methods
# Test error cases (404, 500, etc.)
# Test with invalid routes
```

---

### Step 5: Deployment (1-2 hours)

#### Deploy to Staging

```bash
# Deploy new function
supabase functions deploy admin-api --project-ref <staging-ref>

# Test in staging
curl https://<staging-project>.supabase.co/functions/v1/admin-api/health

# Run smoke tests on all routes
./scripts/test/admin-api-smoke-test.sh
```

#### Monitor Staging (24h)

- Check logs for errors
- Monitor performance
- Verify all routes working

#### Deploy to Production

```bash
# Deploy to production
supabase functions deploy admin-api --project-ref <prod-ref>

# Monitor closely for 24-48h
# Check error rates
# Verify functionality
```

---

### Step 6: Archive Old Functions (30 mins)

```bash
# Only after confirming new admin-api works perfectly

# Create archive directory
mkdir -p supabase/functions/.archived

# Archive old functions
mv supabase/functions/admin-health supabase/functions/.archived/admin-health-20251210
mv supabase/functions/admin-messages supabase/functions/.archived/admin-messages-20251210
mv supabase/functions/admin-settings supabase/functions/.archived/admin-settings-20251210
mv supabase/functions/admin-stats supabase/functions/.archived/admin-stats-20251210
mv supabase/functions/admin-users supabase/functions/.archived/admin-users-20251210
mv supabase/functions/admin-trips supabase/functions/.archived/admin-trips-20251210

# Commit
git add -A
git commit -m "chore: Archive old admin functions after successful consolidation"
```

---

## 📊 Migration Guide

### For API Consumers

**Old URLs:**

```
POST https://<project>.supabase.co/functions/v1/admin-health
POST https://<project>.supabase.co/functions/v1/admin-messages
POST https://<project>.supabase.co/functions/v1/admin-settings
POST https://<project>.supabase.co/functions/v1/admin-stats
POST https://<project>.supabase.co/functions/v1/admin-users
POST https://<project>.supabase.co/functions/v1/admin-trips
```

**New URLs:**

```
POST https://<project>.supabase.co/functions/v1/admin-api/health
POST https://<project>.supabase.co/functions/v1/admin-api/messages
POST https://<project>.supabase.co/functions/v1/admin-api/settings
POST https://<project>.supabase.co/functions/v1/admin-api/stats
POST https://<project>.supabase.co/functions/v1/admin-api/users
POST https://<project>.supabase.co/functions/v1/admin-api/trips
```

**Migration Strategy:**

1. Deploy new admin-api alongside old functions
2. Update clients to use new URLs (gradual rollout)
3. Monitor both endpoints for 1-2 weeks
4. After confirming all clients migrated, archive old functions

---

## ✅ Success Criteria

- [ ] All 6 routes implemented and tested
- [ ] Local tests passing
- [ ] Deployed to staging successfully
- [ ] Staging tests passing for 24h
- [ ] Deployed to production successfully
- [ ] Production monitored for 48h with no issues
- [ ] API consumers migrated to new URLs
- [ ] Old functions archived (not deleted)
- [ ] Documentation updated
- [ ] Functions count: 117 → 112 ✅

---

## ⚠️ Rollback Plan

If issues arise:

1. **Immediate:** Route traffic back to old functions
2. **Fix:** Debug issue in admin-api
3. **Re-deploy:** After fixing
4. **Monitor:** Carefully before archiving old functions

Old functions should remain deployed for 1-2 weeks as fallback.

---

## 📝 Next Steps After Completion

1. **Cleanup Jobs Consolidation** (4 → 1, save 3)
2. **Auth QR Consolidation** (3 → 1, save 2)
3. **Additional function analysis** (identify next consolidation opportunities)

**Total Potential:** 10 functions saved in Phase 2 quick wins

---

**Estimated Timeline:** 1 week (including testing and monitoring)  
**Risk Level:** LOW  
**Impact:** HIGH (5 functions saved)  
**Ready to implement!**
