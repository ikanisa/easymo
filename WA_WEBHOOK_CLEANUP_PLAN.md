# WhatsApp Webhook Cleanup & Optimization Plan
## Detailed Implementation Guide

**Project:** wa-webhook-mobility & wa-webhook-profile Cleanup  
**Date:** 2025-12-14  
**Duration:** 13 days (2.6 weeks)  
**Effort:** 1 developer full-time

---

## Quick Start

```bash
# 1. Backup current state
git checkout -b feature/webhook-cleanup
git tag backup-before-cleanup

# 2. Start with Phase 1 (deduplication)
# See detailed steps below

# 3. Run tests after each phase
pnpm exec vitest run
pnpm test:functions
```

---

## Phase 1: Deduplication (Days 1-2)

### Goal
Remove 48 duplicate files, establish single source of truth in `_shared/`

### Pre-requisites
- [x] Full test suite passing
- [x] Backup created
- [x] Code review of both services completed

### Step 1.1: Analyze Import Usage (30 mins)

```bash
# Find all files importing from local utils
cd /Users/jeanbosco/workspace/easymo/supabase/functions/wa-webhook-mobility
grep -r "from \"\./utils/" . | cut -d: -f1 | sort -u > /tmp/files-to-update.txt

# Count: should be ~30-40 files
wc -l /tmp/files-to-update.txt
```

**Output:** List of files that need import updates

### Step 1.2: Backup Current State (15 mins)

```bash
# Create backup of directories to be deleted
tar -czf /tmp/wa-webhook-mobility-backup.tar.gz \
  wa-webhook-mobility/utils \
  wa-webhook-mobility/observe

# Verify backup
tar -tzf /tmp/wa-webhook-mobility-backup.tar.gz | head
```

### Step 1.3: Delete Duplicate Utils (5 mins)

```bash
cd /Users/jeanbosco/workspace/easymo/supabase/functions/wa-webhook-mobility

# Delete all utils files (35 files)
rm -rf utils/

# Delete duplicate observe files (keep only logger.ts)
cd observe
mv logger.ts /tmp/logger.ts.keep
rm -f *.ts *.backup* *.fixed
mv /tmp/logger.ts.keep logger.ts

# Verify
ls -la  # Should only see logger.ts
```

### Step 1.4: Update Imports - Automated Script (2 hours)

Create `scripts/fix-imports.sh`:

```bash
#!/bin/bash
# Fix imports from local to shared

set -e

MOBILITY_DIR="supabase/functions/wa-webhook-mobility"
SHARED_DIR="../_shared/wa-webhook-shared"

echo "Fixing imports in wa-webhook-mobility..."

# Function to update imports in a file
fix_imports() {
  local file="$1"
  echo "Processing: $file"
  
  # Backup
  cp "$file" "$file.bak"
  
  # Fix utils imports
  sed -i '' 's|from "\./utils/|from "'"$SHARED_DIR"'/utils/|g' "$file"
  sed -i '' 's|from "\.\./utils/|from "../../'"$SHARED_DIR"'/utils/|g' "$file"
  sed -i '' 's|from "\.\./\.\./utils/|from "../../../'"$SHARED_DIR"'/utils/|g' "$file"
  
  # Fix observe imports (except logger.ts)
  sed -i '' 's|from "\./observe/log\.ts"|from "../_shared/observability.ts"|g' "$file"
  sed -i '' 's|from "\.\./observe/log\.ts"|from "../../_shared/observability.ts"|g' "$file"
  
  # Fix wa imports
  sed -i '' 's|from "\./wa/|from "'"$SHARED_DIR"'/wa/|g' "$file"
  sed -i '' 's|from "\.\./wa/|from "../../'"$SHARED_DIR"'/wa/|g' "$file"
  
  # Fix state imports
  sed -i '' 's|from "\./state/|from "'"$SHARED_DIR"'/state/|g' "$file"
  sed -i '' 's|from "\.\./state/|from "../../'"$SHARED_DIR"'/state/|g' "$file"
  
  # Fix i18n imports
  sed -i '' 's|from "\./i18n/|from "'"$SHARED_DIR"'/i18n/|g' "$file"
  sed -i '' 's|from "\.\./i18n/|from "../../'"$SHARED_DIR"'/i18n/|g' "$file"
}

# Find all TypeScript files and fix them
find "$MOBILITY_DIR" -name "*.ts" -type f | while read file; do
  fix_imports "$file"
done

echo "Done! Created .bak files for rollback if needed"
echo "To remove backups: find $MOBILITY_DIR -name '*.bak' -delete"
```

**Run it:**
```bash
chmod +x scripts/fix-imports.sh
./scripts/fix-imports.sh
```

### Step 1.5: Manual Verification (1 hour)

Check key files:

```bash
# 1. Main index
grep "^import" supabase/functions/wa-webhook-mobility/index.ts

# Expected: Should see ../_shared/ imports, not ./utils/ or ./observe/

# 2. Key handlers
grep "^import" supabase/functions/wa-webhook-mobility/handlers/nearby.ts
grep "^import" supabase/functions/wa-webhook-mobility/handlers/schedule.ts

# 3. Check for any remaining local imports
grep -r "from \"\./utils/" supabase/functions/wa-webhook-mobility/
# Expected: No results

grep -r "from \"\./observe/log" supabase/functions/wa-webhook-mobility/
# Expected: No results (except logger.ts itself)
```

### Step 1.6: Fix Remaining Issues (1 hour)

Common issues:

```typescript
// Issue 1: Relative path depth incorrect
// Before (wrong)
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";

// After (correct from mobility/handlers/)
import { sendText } from "../../../_shared/wa-webhook-shared/wa/client.ts";

// Issue 2: Missing shared location imports
// Add to files that need locations
import { recordLastLocation } from "../../_shared/wa-webhook-shared/locations/favorites.ts";

// Issue 3: State imports
// Use shared state if available
import { getState, setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
```

### Step 1.7: Run Tests (30 mins)

```bash
# 1. Type check
cd /Users/jeanbosco/workspace/easymo
pnpm exec tsc --noEmit

# 2. Vitest
pnpm exec vitest run

# 3. Deno tests
pnpm test:functions

# 4. Lint
pnpm lint
```

**Expected Results:**
- Type check: ✅ 0 errors
- Vitest: ✅ 84 tests pass
- Deno: ✅ All functions tests pass
- Lint: ✅ 2 warnings (acceptable per repo docs)

### Step 1.8: Deploy Test (1 hour)

```bash
# Deploy to dev/staging environment
supabase functions deploy wa-webhook-mobility --project-ref YOUR_PROJECT

# Test health endpoint
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-mobility/health

# Send test webhook
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-mobility \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=test" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"250788123456","type":"text","text":{"body":"hi"}}]}}]}]}'
```

### Step 1.9: Commit & PR (30 mins)

```bash
# Remove backup files
find supabase/functions/wa-webhook-mobility -name "*.bak" -delete

# Commit
git add .
git commit -m "refactor(webhooks): deduplicate utils and observe files

- Remove 35 duplicate utils files from wa-webhook-mobility
- Remove 7 duplicate observe files (keep only logger.ts)
- Update all imports to use shared modules from _shared/wa-webhook-shared
- Establishes single source of truth for utilities

Closes #XXX"

# Push and create PR
git push origin feature/webhook-cleanup
gh pr create --title "Phase 1: Deduplicate webhook utilities" \
  --body "See WA_WEBHOOK_CLEANUP_PLAN.md for details"
```

### Rollback Plan (if needed)

```bash
# Restore from backup
cd /Users/jeanbosco/workspace/easymo/supabase/functions/wa-webhook-mobility
tar -xzf /tmp/wa-webhook-mobility-backup.tar.gz

# Restore backups
find . -name "*.bak" | while read backup; do
  original="${backup%.bak}"
  mv "$backup" "$original"
done

# Revert git
git reset --hard HEAD^
```

---

## Phase 2: Consolidate Logging (Days 3-5)

### Goal
Single logging system using `observe/logger.ts` (Sentry + PostHog ready)

### Step 2.1: Prepare Unified Logger (1 hour)

```bash
cd /Users/jeanbosco/workspace/easymo/supabase/functions

# Move logger.ts to shared
mkdir -p _shared/observability
cp wa-webhook-mobility/observe/logger.ts _shared/observability/logger.ts

# Update exports
cat > _shared/observability/index.ts << 'EOF'
/**
 * Unified Observability Module
 * Provides structured logging, error tracking, and metrics
 */

export {
  logStructuredEvent,
  recordMetric,
  logError,
  scrubPII,
  normalizeError,
  serveWithObservability,
  createJsonErrorResponse,
  type StructuredLogger,
  type ObservabilityContext,
} from "./logger.ts";
EOF
```

### Step 2.2: Update wa-webhook-mobility (2 hours)

Create migration script `scripts/migrate-logging.sh`:

```bash
#!/bin/bash
# Migrate from old logging to new unified system

set -e

MOBILITY_DIR="supabase/functions/wa-webhook-mobility"

echo "Migrating logging in wa-webhook-mobility..."

# Replace all old logging imports
find "$MOBILITY_DIR" -name "*.ts" -type f | while read file; do
  echo "Processing: $file"
  
  # Backup
  cp "$file" "$file.log-bak"
  
  # Replace imports
  sed -i '' 's|from "../_shared/observability\.ts"|from "../_shared/observability/index.ts"|g' "$file"
  sed -i '' 's|from "../../_shared/observability\.ts"|from "../../_shared/observability/index.ts"|g' "$file"
  sed -i '' 's|from "\./observe/log\.ts"|from "../_shared/observability/index.ts"|g' "$file"
  sed -i '' 's|from "\.\./observe/log\.ts"|from "../../_shared/observability/index.ts"|g' "$file"
  sed -i '' 's|from "\./observe/logging\.ts"|from "../_shared/observability/index.ts"|g' "$file"
done

echo "Done!"
```

Run it:
```bash
chmod +x scripts/migrate-logging.sh
./scripts/migrate-logging.sh
```

### Step 2.3: Update wa-webhook-profile (2 hours)

Same process:

```bash
# Update all imports in profile
find supabase/functions/wa-webhook-profile -name "*.ts" -type f | while read file; do
  sed -i '' 's|from "../_shared/observability\.ts"|from "../_shared/observability/index.ts"|g' "$file"
done
```

### Step 2.4: Remove Old Logging Files (30 mins)

```bash
# Delete old logging implementations
rm supabase/functions/wa-webhook-mobility/observe/log.ts.backup*
rm supabase/functions/wa-webhook-mobility/observe/log.ts.fixed

# Keep logger.ts as symlink (optional)
cd supabase/functions/wa-webhook-mobility/observe
rm logger.ts
ln -s ../../../_shared/observability/logger.ts logger.ts
```

### Step 2.5: Configure Sentry & PostHog (2 hours)

```bash
# 1. Set up Sentry project
# Go to sentry.io → Create Project → Choose "Deno"

# 2. Add secrets to Supabase
supabase secrets set SENTRY_DSN_SUPABASE=https://xxx@xxx.ingest.sentry.io/xxx
supabase secrets set POSTHOG_API_KEY=phc_xxxxxxxxxxxxx
supabase secrets set POSTHOG_HOST=https://app.posthog.com

# 3. Set sampling rates
supabase secrets set SENTRY_TRACES_SAMPLE_RATE=0.2
supabase secrets set SENTRY_PROFILES_SAMPLE_RATE=0.1

# 4. Verify
supabase secrets list
```

### Step 2.6: Test New Logging (1 hour)

```bash
# 1. Deploy
supabase functions deploy wa-webhook-mobility
supabase functions deploy wa-webhook-profile

# 2. Trigger error to test Sentry
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-mobility/trigger-error

# 3. Check Sentry dashboard
# Should see error captured with:
# - Service tag: wa-webhook-mobility
# - Correlation ID
# - PII scrubbed

# 4. Check PostHog events
# Should see:
# - edge.request.start
# - edge.request.complete
```

### Step 2.7: Run Full Test Suite (1 hour)

```bash
pnpm exec vitest run
pnpm test:functions
pnpm lint

# Manual smoke tests
# Test 5-10 common flows per service
```

### Step 2.8: Commit (30 mins)

```bash
git add .
git commit -m "refactor(webhooks): consolidate to unified logging system

- Move logger.ts to _shared/observability
- Replace 3 old logging systems with single unified one
- Enable Sentry error tracking
- Enable PostHog analytics
- Add PII scrubbing to all logs

Closes #XXX"

git push origin feature/webhook-cleanup
```

---

## Phase 3: Reduce Log Noise (Day 6)

### Goal
70% reduction in log volume, cleaner logs

### Step 3.1: Remove Diagnostic Logs (2 hours)

Find and remove:

```bash
# Find all "DIAGNOSTIC" logs
grep -rn "DIAGNOSTIC" supabase/functions/wa-webhook-mobility/

# Remove them manually
# Example: index.ts line 313 - delete entire section
```

Manual edits:
```typescript
// DELETE THIS:
// DIAGNOSTIC LOGGING REMOVED
await logStructuredEvent("LOG", {
  data: JSON.stringify({
    event: "MOBILITY_LAUNCHING_WORKFLOW",
    workflow: "handleSeeDrivers",
  }),
});

// REPLACE WITH THIS:
// (nothing - just start the handler)
```

### Step 3.2: Consolidate Redundant Logs (2 hours)

```typescript
// BEFORE: 3 log calls
logEvent("MOBILITY_LAUNCHING_WORKFLOW", { workflow: "handleSeeDrivers" });
handled = await handleSeeDrivers(ctx);
logEvent("MOBILITY_WORKFLOW_RESULT", { workflow: "handleSeeDrivers", handled });

// AFTER: 1 metric call
const startTime = Date.now();
handled = await handleSeeDrivers(ctx);
if (!handled) {
  logStructuredEvent("WORKFLOW_UNHANDLED", { workflow: "handleSeeDrivers" }, "warn");
}
recordMetric("workflow.duration_ms", Date.now() - startTime, { 
  workflow: "handleSeeDrivers", 
  handled: String(handled)
});
```

Apply to ~20 locations in mobility/index.ts

### Step 3.3: Use Log Levels Properly (1 hour)

```typescript
// DEBUG level (only in dev)
logStructuredEvent("STATE_LOADED", { key: state?.key }, "debug");

// INFO level (normal operations)
logStructuredEvent("MESSAGE_PROCESSED", { from, type: message.type });

// WARN level (recoverable issues)
logStructuredEvent("AUTH_BYPASS", { reason: "dev_mode" }, "warn");

// ERROR level (failures)
logStructuredEvent("WEBHOOK_ERROR", { error: err.message }, "error");
```

Update ~30 log calls to use appropriate levels.

### Step 3.4: Configure Log Filtering (30 mins)

```typescript
// supabase/functions/_shared/observability/logger.ts
// Add at top:
const LOG_LEVEL = Deno.env.get("LOG_LEVEL") ?? "info";
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// Update writeLog function:
const writeLog = (level, service, requestId, payload) => {
  if (LOG_LEVELS[level] < LOG_LEVELS[LOG_LEVEL]) {
    return; // Skip logs below threshold
  }
  // ... rest of function
};
```

### Step 3.5: Test & Measure (1 hour)

```bash
# Before cleanup - count logs in 100 webhook calls
# (Use production logs or simulate)
OLD_LOG_COUNT=500  # Example

# Deploy new version
supabase functions deploy wa-webhook-mobility

# After cleanup - count logs in 100 webhook calls
NEW_LOG_COUNT=150  # Expected ~70% reduction

echo "Log reduction: $(( (OLD_LOG_COUNT - NEW_LOG_COUNT) * 100 / OLD_LOG_COUNT ))%"
```

### Step 3.6: Commit (15 mins)

```bash
git add .
git commit -m "refactor(webhooks): reduce log noise by 70%

- Remove diagnostic logging sections
- Consolidate redundant log calls
- Use proper log levels (debug/info/warn/error)
- Add LOG_LEVEL env var support

Impact: 70% fewer log entries, easier debugging"

git push origin feature/webhook-cleanup
```

---

## Phase 4: Refactor Index Files (Days 7-10)

### Goal
Break down monolithic index.ts files into modular routers

### Step 4.1: Extract Mobility Router (Day 7)

Create router structure:

```bash
mkdir -p supabase/functions/wa-webhook-mobility/router
touch supabase/functions/wa-webhook-mobility/router/interactive.ts
touch supabase/functions/wa-webhook-mobility/router/location.ts
touch supabase/functions/wa-webhook-mobility/router/text.ts
touch supabase/functions/wa-webhook-mobility/router/media.ts
touch supabase/functions/wa-webhook-mobility/router/index.ts
```

**router/interactive.ts:**
```typescript
import type { RouterContext, State } from "../types.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { handleSeeDrivers, handleSeePassengers } from "../handlers/nearby.ts";
// ... other imports

/**
 * Handle all interactive button/list replies
 */
export async function routeInteractive(
  ctx: RouterContext,
  id: string,
  state: State | null
): Promise<boolean> {
  // Mobility main menu
  if (id === IDS.RIDES_MENU || id === "rides_agent" || id === "rides") {
    return await showMobilityMenu(ctx);
  }
  
  // Nearby flows
  if (id === IDS.SEE_DRIVERS) {
    return await handleSeeDrivers(ctx);
  }
  
  if (id === IDS.SEE_PASSENGERS) {
    return await handleSeePassengers(ctx);
  }
  
  // ... rest of button handlers (move from index.ts lines 335-645)
  
  return false;
}

async function showMobilityMenu(ctx: RouterContext): Promise<boolean> {
  // Move from index.ts lines 767-804
}
```

**router/location.ts:**
```typescript
export async function routeLocation(
  ctx: RouterContext,
  coords: { lat: number; lng: number },
  state: State | null
): Promise<boolean> {
  if (!state) return false;
  
  // Move location handling from index.ts lines 648-677
  if (state.key === STATE_KEYS.MOBILITY.NEARBY_LOCATION) {
    return await handleNearbyLocation(ctx, state.data, coords);
  }
  
  if (state.key === STATE_KEYS.MOBILITY.GO_ONLINE) {
    return await handleGoOnlineLocation(ctx, coords);
  }
  
  // ... etc
  
  return false;
}
```

**router/text.ts:**
```typescript
export async function routeText(
  ctx: RouterContext,
  text: string,
  state: State | null
): Promise<boolean> {
  // Move text handling from index.ts lines 690-738
  
  // Vehicle plate input
  if (state?.key === vehiclePlateStateKey) {
    // ...
  }
  
  // Keyword triggers
  if (text.includes("driver") || text.includes("ride")) {
    return await handleSeeDrivers(ctx);
  }
  
  // ... etc
  
  return false;
}
```

**router/media.ts:**
```typescript
export async function routeMedia(
  ctx: RouterContext,
  mediaId: string,
  mimeType: string,
  state: State | null
): Promise<boolean> {
  // Move media handling from index.ts lines 679-688
  
  if (state?.key === VERIFICATION_STATES.LICENSE_UPLOAD) {
    return await handleLicenseUpload(ctx, mediaId, mimeType);
  }
  
  return false;
}
```

**router/index.ts:**
```typescript
import type { RouterContext, WhatsAppMessage, State } from "../types.ts";
import { routeInteractive } from "./interactive.ts";
import { routeLocation } from "./location.ts";
import { routeText } from "./text.ts";
import { routeMedia } from "./media.ts";

export async function routeMessage(
  ctx: RouterContext,
  message: WhatsAppMessage,
  state: State | null
): Promise<boolean> {
  // Interactive (buttons/lists)
  if (message.type === "interactive") {
    const interactive = message.interactive as any;
    const id = interactive?.button_reply?.id || interactive?.list_reply?.id;
    if (id) {
      return await routeInteractive(ctx, id, state);
    }
  }
  
  // Location
  if (message.type === "location") {
    const loc = message.location as any;
    if (loc?.latitude && loc?.longitude) {
      return await routeLocation(ctx, {
        lat: Number(loc.latitude),
        lng: Number(loc.longitude)
      }, state);
    }
  }
  
  // Media (image/document)
  if (message.type === "image" || message.type === "document") {
    const mediaId = (message.image as any)?.id || (message.document as any)?.id;
    const mimeType = (message.image as any)?.mime_type || 
                     (message.document as any)?.mime_type || "image/jpeg";
    if (mediaId) {
      return await routeMedia(ctx, mediaId, mimeType, state);
    }
  }
  
  // Text
  if (message.type === "text") {
    const text = (message.text as any)?.body ?? "";
    return await routeText(ctx, text, state);
  }
  
  return false;
}
```

**New index.ts (simplified):**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "./deps.ts";
import { logStructuredEvent } from "../_shared/observability/index.ts";
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
import { verifyWebhookSignature } from "../_shared/webhook-utils.ts";
import { ensureProfile } from "../_shared/wa-webhook-shared/utils/profile.ts";
import { getState } from "./state/store.ts";
import { routeMessage } from "./router/index.ts";
import type { RouterContext, WhatsAppWebhookPayload } from "./types.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  
  // Health check
  if (url.pathname.endsWith("/health")) {
    return new Response(JSON.stringify({
      status: "healthy",
      service: "wa-webhook-mobility",
      timestamp: new Date().toISOString()
    }), { headers: { "Content-Type": "application/json" } });
  }
  
  // GET: Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    if (mode === "subscribe" && token === Deno.env.get("WA_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  
  // POST: Process webhook
  try {
    // Rate limit check
    const rateLimitCheck = await rateLimitMiddleware(req, { limit: 100, windowSeconds: 60 });
    if (!rateLimitCheck.allowed) return rateLimitCheck.response!;
    
    // Verify signature
    const rawBody = await req.text();
    if (rawBody.length > 1024 * 1024) {
      return new Response(JSON.stringify({ error: "payload_too_large" }), { status: 413 });
    }
    
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    if (!appSecret) {
      return new Response(JSON.stringify({ error: "server_misconfigured" }), { status: 500 });
    }
    
    if (signature && !await verifyWebhookSignature(rawBody, signature, appSecret)) {
      const allowUnsigned = Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") === "true";
      if (!allowUnsigned) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
      }
    }
    
    // Parse payload
    const payload: WhatsAppWebhookPayload = JSON.parse(rawBody);
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message?.from) {
      return new Response(JSON.stringify({ success: true, ignored: "no_message" }));
    }
    
    // Build context
    const profile = await ensureProfile(supabase, message.from);
    const ctx: RouterContext = {
      supabase,
      from: message.from,
      profileId: profile?.user_id,
      locale: (profile?.language as any) || "en"
    };
    
    // Get state
    const state = ctx.profileId ? await getState(supabase, ctx.profileId) : null;
    
    // Route message
    const handled = await routeMessage(ctx, message, state);
    
    if (!handled) {
      logStructuredEvent("UNHANDLED_MESSAGE", { from: message.from, type: message.type }, "debug");
    }
    
    return new Response(JSON.stringify({ success: true, handled }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (err) {
    logStructuredEvent("WEBHOOK_ERROR", {
      error: err instanceof Error ? err.message : String(err)
    }, "error");
    
    return new Response(JSON.stringify({
      error: "internal_error",
      requestId
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

logStructuredEvent("SERVICE_STARTED", {
  service: "wa-webhook-mobility",
  version: "2.0.0"
});
```

### Step 4.2: Extract Profile Router (Days 8-9)

Same process for wa-webhook-profile:

```bash
mkdir -p supabase/functions/wa-webhook-profile/router
# Create interactive.ts, location.ts, text.ts
```

Move 80+ button handlers from index.ts to router/interactive.ts

### Step 4.3: Test Refactored Services (Day 10)

```bash
# Type check
pnpm exec tsc --noEmit

# Unit tests
pnpm exec vitest run

# Integration tests
pnpm test:functions

# Manual smoke tests
# Test 10-15 key flows per service
```

### Step 4.4: Commit (30 mins)

```bash
git add .
git commit -m "refactor(webhooks): extract routers from monolithic index files

- Create modular router structure (interactive, location, text, media)
- Reduce index.ts from 800+ to ~150 lines
- Improve testability and maintainability

Before:
- mobility/index.ts: 804 lines
- profile/index.ts: 1006 lines

After:
- mobility/index.ts: 150 lines
- profile/index.ts: 180 lines
- + 8 new router files"

git push origin feature/webhook-cleanup
```

---

## Phase 5: Enable Observability (Days 11-12)

### Goal
Production-grade monitoring with Sentry, PostHog, health metrics

### Step 5.1: Configure Sentry (Day 11 AM)

Already done in Phase 2, verify:

```bash
# Check Sentry is receiving errors
# 1. Trigger test error
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-mobility \
  -H "Content-Type: application/json" \
  -d '{"test":"invalid"}'

# 2. Check Sentry dashboard
# Should see error with:
# - Service: wa-webhook-mobility
# - Environment: production
# - PII scrubbed
```

### Step 5.2: Configure PostHog Events (Day 11 PM)

Add key events:

```typescript
// In router/interactive.ts
export async function routeInteractive(ctx, id, state) {
  // Track button clicks
  await ctx.track?.("button_clicked", {
    button_id: id,
    has_state: Boolean(state),
    user_locale: ctx.locale
  });
  
  // ... rest of handler
}

// In handlers/nearby.ts
export async function handleNearbyLocation(ctx, data, coords) {
  const startTime = Date.now();
  
  // ... matching logic
  
  // Track match performance
  await ctx.track?.("nearby_match_completed", {
    duration_ms: Date.now() - startTime,
    matches_found: matches.length,
    vehicle_type: data.vehicleType
  });
}
```

Add to 10-15 key user actions.

### Step 5.3: Add Health Metrics (Day 12 AM)

```typescript
// supabase/functions/wa-webhook-mobility/health.ts
import { createClient } from "./deps.ts";

export async function getHealthMetrics() {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  
  // DB connectivity
  const dbStart = Date.now();
  const { error: dbError } = await supabase.from("profiles").select("user_id").limit(1);
  const dbLatency = Date.now() - dbStart;
  
  // Cache connectivity (if using Redis)
  // const cacheHealthy = await checkRedis();
  
  return {
    status: dbError ? "unhealthy" : "healthy",
    checks: {
      database: {
        status: dbError ? "down" : "up",
        latency_ms: dbLatency,
        error: dbError?.message
      }
    },
    timestamp: new Date().toISOString()
  };
}

// Update index.ts health endpoint
if (url.pathname.endsWith("/health")) {
  const metrics = await getHealthMetrics();
  return new Response(JSON.stringify(metrics), {
    status: metrics.status === "healthy" ? 200 : 503,
    headers: { "Content-Type": "application/json" }
  });
}
```

### Step 5.4: Set Up Alerting (Day 12 PM)

**Sentry Alerts:**
1. Go to Sentry → Alerts → Create Alert Rule
2. Create alerts for:
   - Error rate > 5% (15 min window)
   - New issue type discovered
   - Performance degradation (p95 > 1000ms)

**PostHog Alerts:**
1. Go to PostHog → Insights → Create
2. Create metrics for:
   - User drop-off rate > 30%
   - Button click success rate < 95%
   - API errors per hour

**Supabase Health Monitoring:**
```bash
# Use uptime monitoring service (e.g., Uptime Robot)
# Monitor: https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-mobility/health
# Alert if: Status != 200 OR response time > 2s
```

### Step 5.5: Test & Verify (1 hour)

```bash
# 1. Generate test traffic
# Run 100 webhook calls with various scenarios

# 2. Verify Sentry dashboard
# - Should see events grouped by issue
# - PII should be scrubbed
# - Performance metrics visible

# 3. Verify PostHog dashboard
# - Should see event funnel
# - User properties populated
# - Conversion rates visible

# 4. Test alerts
# - Trigger error spike
# - Should receive alert within 5 minutes
```

### Step 5.6: Commit (15 mins)

```bash
git add .
git commit -m "feat(webhooks): enable production observability

- Configure Sentry error tracking and performance monitoring
- Add PostHog event tracking for 15 key user actions
- Enhance health endpoint with detailed metrics
- Set up alerting for error rates and drop-offs

Monitoring now includes:
- Error tracking with PII scrubbing
- User behavior analytics
- Performance metrics (p50, p95, p99)
- Health checks with DB latency"

git push origin feature/webhook-cleanup
```

---

## Phase 6: Feature Flags (Day 13)

### Goal
Safe feature rollout with gradual deployment

### Step 6.1: Create Feature Flag Service (2 hours)

```typescript
// supabase/functions/_shared/feature-flags.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rollout_percentage: number;
  description: string;
  created_at: string;
  updated_at: string;
}

/**
 * Check if a feature is enabled for a user
 * Supports: full on/off, percentage rollout, user-specific overrides
 */
export async function isEnabled(
  supabase: SupabaseClient,
  flagName: string,
  userId?: string
): Promise<boolean> {
  // Check cache first (5 min TTL)
  const cacheKey = `feature_flag:${flagName}`;
  const cached = await getCached(cacheKey);
  if (cached !== null) {
    return rolloutDecision(cached, userId);
  }
  
  // Fetch from DB
  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .eq("name", flagName)
    .single();
  
  if (error || !data) {
    // Default to disabled if flag not found
    return false;
  }
  
  // Cache for 5 minutes
  await setCache(cacheKey, data, 300);
  
  return rolloutDecision(data, userId);
}

function rolloutDecision(flag: FeatureFlag, userId?: string): boolean {
  if (!flag.enabled) return false;
  if (flag.rollout_percentage === 100) return true;
  if (flag.rollout_percentage === 0) return false;
  
  // Gradual rollout: hash user ID to get consistent bucket
  if (!userId) return false;
  
  const hash = simpleHash(userId + flag.name);
  const bucket = hash % 100;
  return bucket < flag.rollout_percentage;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Cache helpers (use Supabase edge runtime cache or Redis)
async function getCached(key: string): Promise<FeatureFlag | null> {
  // Implement based on your cache strategy
  return null;
}

async function setCache(key: string, value: FeatureFlag, ttl: number): Promise<void> {
  // Implement based on your cache strategy
}

/**
 * Bulk check multiple flags (more efficient)
 */
export async function isEnabledBulk(
  supabase: SupabaseClient,
  flagNames: string[],
  userId?: string
): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .in("name", flagNames);
  
  if (error || !data) {
    return Object.fromEntries(flagNames.map(name => [name, false]));
  }
  
  return Object.fromEntries(
    data.map(flag => [flag.name, rolloutDecision(flag, userId)])
  );
}
```

### Step 6.2: Create Database Table (30 mins)

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_feature_flags.sql
BEGIN;

CREATE TABLE IF NOT EXISTS feature_flags (
  name TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write
CREATE POLICY "Service role full access" ON feature_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add some initial flags
INSERT INTO feature_flags (name, enabled, rollout_percentage, description) VALUES
  ('ai_agents', false, 0, 'Enable AI-powered customer support agents'),
  ('enhanced_matching', true, 50, 'New matching algorithm for nearby rides'),
  ('momo_qr_v2', false, 0, 'Enhanced MoMo QR code generation');

COMMIT;
```

Apply migration:
```bash
supabase db push
```

### Step 6.3: Use Feature Flags (2 hours)

Add to wa-webhook-mobility/handlers/nearby.ts:

```typescript
import { isEnabled } from "../../_shared/feature-flags.ts";

export async function handleSeeDrivers(ctx: RouterContext) {
  // Check if enhanced matching is enabled for this user
  const useEnhancedMatching = await isEnabled(
    ctx.supabase,
    "enhanced_matching",
    ctx.profileId
  );
  
  if (useEnhancedMatching) {
    return await enhancedMatchingFlow(ctx);
  } else {
    return await legacyMatchingFlow(ctx);
  }
}
```

Add to wa-webhook-mobility/ai-agents/index.ts:

```typescript
export async function handleAIAgent(ctx: RouterContext, message: string) {
  // Check if AI agents feature is enabled
  const aiEnabled = await isEnabled(
    ctx.supabase,
    "ai_agents",
    ctx.profileId
  );
  
  if (!aiEnabled) {
    return false; // Fall back to rule-based handling
  }
  
  // ... AI agent logic
}
```

Add to main router:

```typescript
// router/index.ts
import { isEnabledBulk } from "../../_shared/feature-flags.ts";

export async function routeMessage(ctx, message, state) {
  // Bulk check flags at start of request
  const flags = await isEnabledBulk(ctx.supabase, [
    "ai_agents",
    "enhanced_matching",
    "momo_qr_v2"
  ], ctx.profileId);
  
  // Pass flags to handlers via context
  const enhancedCtx = { ...ctx, flags };
  
  // ... rest of routing
}
```

### Step 6.4: Admin UI for Flags (1 hour)

Add to admin-app:

```typescript
// admin-app/app/feature-flags/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState([]);
  const supabase = createClient();
  
  useEffect(() => {
    loadFlags();
  }, []);
  
  async function loadFlags() {
    const { data } = await supabase.from("feature_flags").select("*");
    setFlags(data || []);
  }
  
  async function toggleFlag(name: string, enabled: boolean) {
    await supabase
      .from("feature_flags")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("name", name);
    loadFlags();
  }
  
  async function updateRollout(name: string, percentage: number) {
    await supabase
      .from("feature_flags")
      .update({ rollout_percentage: percentage, updated_at: new Date().toISOString() })
      .eq("name", name);
    loadFlags();
  }
  
  return (
    <div>
      <h1>Feature Flags</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Enabled</th>
            <th>Rollout %</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {flags.map(flag => (
            <tr key={flag.name}>
              <td>{flag.name}</td>
              <td>
                <input
                  type="checkbox"
                  checked={flag.enabled}
                  onChange={(e) => toggleFlag(flag.name, e.target.checked)}
                />
              </td>
              <td>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={flag.rollout_percentage}
                  onChange={(e) => updateRollout(flag.name, parseInt(e.target.value))}
                  disabled={!flag.enabled}
                />
                {flag.rollout_percentage}%
              </td>
              <td>{flag.description}</td>
              <td>
                <button onClick={() => updateRollout(flag.name, 0)}>0%</button>
                <button onClick={() => updateRollout(flag.name, 50)}>50%</button>
                <button onClick={() => updateRollout(flag.name, 100)}>100%</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Step 6.5: Test Feature Flags (1 hour)

```bash
# 1. Test flag at 0%
supabase db execute "UPDATE feature_flags SET enabled=true, rollout_percentage=0 WHERE name='enhanced_matching'"
# Test: All users should get old matching

# 2. Test flag at 50%
supabase db execute "UPDATE feature_flags SET rollout_percentage=50 WHERE name='enhanced_matching'"
# Test: ~50% of users should get new matching

# 3. Test flag at 100%
supabase db execute "UPDATE feature_flags SET rollout_percentage=100 WHERE name='enhanced_matching'"
# Test: All users should get new matching

# 4. Test flag disabled
supabase db execute "UPDATE feature_flags SET enabled=false WHERE name='enhanced_matching'"
# Test: All users should get old matching regardless of percentage
```

### Step 6.6: Commit (15 mins)

```bash
git add .
git commit -m "feat(webhooks): add feature flag system

- Create feature_flags table with RLS policies
- Implement isEnabled() with gradual rollout support
- Add admin UI for flag management
- Gate 3 features behind flags: ai_agents, enhanced_matching, momo_qr_v2

Features:
- Per-user percentage rollout (hash-based bucketing)
- Cache layer for performance (5 min TTL)
- Admin UI for toggling and rollout control"

git push origin feature/webhook-cleanup
```

---

## Final Steps

### Merge PR (Day 13 afternoon)

```bash
# 1. Rebase on main
git checkout feature/webhook-cleanup
git rebase main

# 2. Squash commits if needed
git rebase -i HEAD~20  # Adjust number based on commits

# 3. Final test
pnpm exec vitest run
pnpm test:functions
pnpm lint

# 4. Push
git push origin feature/webhook-cleanup --force-with-lease

# 5. Merge PR
gh pr merge --squash --delete-branch
```

### Deploy to Production

```bash
# 1. Deploy functions
supabase functions deploy wa-webhook-mobility --project-ref YOUR_PROJECT
supabase functions deploy wa-webhook-profile --project-ref YOUR_PROJECT

# 2. Verify health
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-mobility/health
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-profile/health

# 3. Monitor
# Watch Sentry for errors
# Watch PostHog for user events
# Watch logs for 1 hour
```

### Document Changes

Update README.md:

```markdown
## Webhook Architecture

### Services
- `wa-webhook-core`: Routes webhooks to specialized handlers
- `wa-webhook-mobility`: Handles ride requests and driver flows
- `wa-webhook-profile`: Manages user profiles and settings

### Logging
All services use unified logging from `_shared/observability`:
- Structured logs with correlation IDs
- Sentry error tracking
- PostHog analytics
- PII scrubbing

### Feature Flags
Control feature rollout via `feature_flags` table:
- Gradual percentage-based rollout
- Per-user bucketing
- Admin UI at `/admin/feature-flags`
```

---

## Rollback Procedures

### If Phase 1 Fails (Deduplication)
```bash
# Restore backup
cd /Users/jeanbosco/workspace/easymo/supabase/functions/wa-webhook-mobility
tar -xzf /tmp/wa-webhook-mobility-backup.tar.gz

# Restore git
git reset --hard backup-before-cleanup
git push origin feature/webhook-cleanup --force
```

### If Phase 2 Fails (Logging)
```bash
# Revert to old logging
git revert HEAD~3..HEAD  # Revert last 3 commits

# Or restore specific files
git checkout HEAD~3 -- supabase/functions/_shared/observability.ts
git checkout HEAD~3 -- supabase/functions/wa-webhook-mobility/observe/
```

### If Phases 3-6 Fail
```bash
# These are additive, just revert the specific phase
git revert <commit-hash>
```

---

## Success Checklist

### Phase 1: Deduplication ✅
- [ ] 48 duplicate files deleted
- [ ] All imports updated to use `_shared/`
- [ ] Zero duplicate utils/observe files
- [ ] All tests passing
- [ ] Deployed and tested in staging

### Phase 2: Logging ✅
- [ ] Single logging system (`_shared/observability`)
- [ ] Sentry enabled and receiving errors
- [ ] PostHog enabled and receiving events
- [ ] PII scrubbing working
- [ ] All services migrated

### Phase 3: Log Noise ✅
- [ ] 70% reduction in log volume
- [ ] Diagnostic logs removed
- [ ] Proper log levels used
- [ ] LOG_LEVEL env var supported

### Phase 4: Refactor ✅
- [ ] index.ts < 150 lines each
- [ ] Router modules created
- [ ] All handlers extracted
- [ ] Tests passing

### Phase 5: Observability ✅
- [ ] Sentry alerts configured
- [ ] PostHog funnels created
- [ ] Health metrics enhanced
- [ ] Alerting working

### Phase 6: Feature Flags ✅
- [ ] feature_flags table created
- [ ] isEnabled() implemented
- [ ] 3+ features gated
- [ ] Admin UI working

---

## Metrics Tracking

| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| Duplicate files | 48 | 0 | ___ |
| Log calls per webhook | ~10 | ~3 | ___ |
| index.ts lines (mobility) | 804 | ~150 | ___ |
| index.ts lines (profile) | 1006 | ~180 | ___ |
| Test coverage | 65% | 80% | ___ |
| Health check latency | - | <100ms | ___ |
| Error rate (Sentry) | - | <1% | ___ |

---

## Contact & Support

**Questions?** Refer to:
- This plan: `WA_WEBHOOK_CLEANUP_PLAN.md`
- Audit report: `WA_WEBHOOK_AUDIT_REPORT.md`
- Ground rules: `docs/GROUND_RULES.md`

**Issues?** Create ticket with:
- Phase number
- Step number
- Error message
- Rollback status

---

**End of Implementation Plan**
