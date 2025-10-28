# Feature Flags Documentation

## Overview

Feature flags enable controlled rollout of new features, A/B testing, and emergency shutoffs without code deployments. All new features in easyMO must be feature-flagged.

## Table of Contents

1. [Flag Types](#flag-types)
2. [Current Flags](#current-flags)
3. [Flag Management](#flag-management)
4. [Implementation Guide](#implementation-guide)
5. [Best Practices](#best-practices)

---

## Flag Types

### Boolean Flags

Simple on/off switches for features.

```sql
INSERT INTO settings (key, value) VALUES ('feature_name.enabled', 'true');
```

### Percentage Rollout Flags

Gradual rollout to a percentage of users.

```sql
INSERT INTO settings (key, value, metadata) VALUES (
  'feature_name.enabled',
  'true',
  jsonb_build_object('rollout_percentage', 25)
);
```

### User Segment Flags

Target specific user groups.

```sql
INSERT INTO settings (key, value, metadata) VALUES (
  'feature_name.enabled',
  'true',
  jsonb_build_object(
    'target_user_ids', ARRAY['uuid1', 'uuid2'],
    'target_roles', ARRAY['beta_tester', 'admin']
  )
);
```

---

## Current Flags

### Infrastructure Flags

#### `router.enabled`

**Purpose**: Master kill switch for WhatsApp router.

**Default**: `true`

**Storage**: Environment variable `ROUTER_ENABLED` + database

**Impact**: Disables all incoming WhatsApp messages.

**Use Cases**:
- Emergency shutoff during incidents
- Maintenance windows
- WhatsApp API issues

**Rollback SLA**: < 1 minute

---

#### `router.signature_verification.enabled`

**Purpose**: Enable/disable WhatsApp signature verification.

**Default**: `true`

**Storage**: Database

**Impact**: Security control. **Never disable in production** except for debugging in staging.

**Use Cases**:
- Local development without valid signatures
- Staging environment testing

---

### Feature Flags

#### `deeplinks.enabled`

**Purpose**: Enable deep-link token generation and resolution.

**Default**: `true`

**Storage**: Database

**Impact**: Affects insurance, basket, and QR flows that use deep-links.

**Dependencies**: 
- `deeplink_tokens` table
- `deeplink-resolver` function

**Metrics**:
- `deeplink.issued` (counter)
- `deeplink.resolved` (counter)
- `deeplink.expired` (counter)

---

#### `favorites.enabled`

**Purpose**: Enable user favorites (saved locations).

**Default**: `true`

**Storage**: Database

**Impact**: Users can save/edit favorite locations for quick booking.

**Dependencies**:
- `user_favorites` table
- Admin panel favorites CRUD

**Metrics**:
- `favorites.created` (counter)
- `favorites.used_in_booking` (counter)

---

#### `recurring_trips.enabled`

**Purpose**: Enable recurring trip scheduling.

**Default**: `true`

**Storage**: Database

**Impact**: Users can schedule recurring rides (daily, weekly, etc.).

**Dependencies**:
- `recurring_trips` table
- `recurring-trips-scheduler` cron job
- Broker matching service

**Metrics**:
- `recurring_trips.created` (counter)
- `recurring_trips.matched` (counter)
- `recurring_trips.auto_booked` (counter)

---

#### `broker.favorites_match.enabled`

**Purpose**: Use favorites in dual-constraint matching.

**Default**: `true`

**Storage**: Database

**Impact**: Broker considers user favorites when matching drivers.

**Dependencies**:
- `favorites.enabled` must be `true`
- Dual-constraint matching algorithm

**Metrics**:
- `broker.favorites_used` (counter)
- `broker.match_improved_by_favorites` (counter)

---

#### `insurance.ocr.enabled`

**Purpose**: Enable OCR processing for insurance documents.

**Default**: `true`

**Storage**: Database

**Impact**: Users can upload images for automatic data extraction.

**Dependencies**:
- `insurance-ocr` function
- OpenAI Vision API

**Metrics**:
- `ocr.documents_processed` (counter)
- `ocr.extraction_success_rate` (gauge)

---

#### `basket.loans.enabled`

**Purpose**: Enable loan features in savings baskets.

**Default**: `true`

**Storage**: Database

**Impact**: Users can request/endorse loans within baskets.

**Dependencies**:
- `basket_loans` table
- `basket_loan_endorsements` table

**Metrics**:
- `basket.loans_requested` (counter)
- `basket.loans_approved` (counter)

---

### Experimental Flags

#### `admin.live_metrics.enabled`

**Purpose**: Enable real-time metrics dashboard.

**Default**: `false`

**Storage**: Database

**Impact**: Admin panel shows live WebSocket metrics.

**Dependencies**:
- WebSocket connection to Supabase
- Real-time database listeners

**Status**: Experimental (not production-ready)

---

#### `ai.voice_agent.enabled`

**Purpose**: Enable AI voice agent for phone calls.

**Default**: `false`

**Storage**: Database

**Impact**: Route voice calls to OpenAI Realtime API.

**Dependencies**:
- `voice-bridge` service
- Twilio integration
- OpenAI Realtime API

**Status**: Beta (limited users only)

---

## Flag Management

### Via Database (Direct SQL)

```sql
-- List all flags
SELECT key, value, metadata, updated_at 
FROM settings 
WHERE key LIKE '%.enabled' 
ORDER BY key;

-- Enable a flag
UPDATE settings 
SET value = 'true', updated_at = NOW() 
WHERE key = 'feature_name.enabled';

-- Disable a flag
UPDATE settings 
SET value = 'false', updated_at = NOW() 
WHERE key = 'feature_name.enabled';

-- Set rollout percentage
UPDATE settings 
SET metadata = jsonb_set(metadata, '{rollout_percentage}', '50') 
WHERE key = 'feature_name.enabled';

-- Add flag with metadata
INSERT INTO settings (key, value, metadata) VALUES (
  'new_feature.enabled',
  'false',
  jsonb_build_object(
    'description', 'New feature description',
    'owner', 'team-name',
    'rollout_percentage', 0,
    'launched_at', NULL,
    'deprecated_at', NULL
  )
);
```

### Via Admin Panel

1. Navigate to **Settings → Feature Flags**
2. Find flag in list or create new
3. Toggle on/off or adjust rollout %
4. Click **Save Changes**
5. Verify in logs that change applied

### Via Environment Variables (Critical Flags)

For flags that control infrastructure (like `ROUTER_ENABLED`):

```bash
# Update Supabase secret
supabase secrets set ROUTER_ENABLED=true --project-ref <project-ref>

# Functions will reload with new value
# No redeploy needed unless code changed
```

---

## Implementation Guide

### Adding a New Flag

#### 1. Define Flag in Database

```sql
INSERT INTO settings (key, value, metadata) VALUES (
  'my_feature.enabled',
  'false',  -- Default OFF in production
  jsonb_build_object(
    'description', 'Description of my feature',
    'owner', 'engineering-team',
    'rollout_percentage', 0,
    'launched_at', NULL,
    'docs_url', 'https://docs.easymo.rw/features/my-feature'
  )
);
```

#### 2. Implement Flag Check

**Supabase Edge Function**:
```typescript
// Fetch flag value
const { data: setting } = await supabase
  .from("settings")
  .select("value, metadata")
  .eq("key", "my_feature.enabled")
  .single();

const isEnabled = setting?.value === "true";
const rolloutPercentage = setting?.metadata?.rollout_percentage ?? 0;

// Check if feature enabled for this user
function isFeatureEnabledForUser(userId: string): boolean {
  if (!isEnabled) return false;
  
  // Check rollout percentage
  const hash = hashUserId(userId); // Consistent hash
  return (hash % 100) < rolloutPercentage;
}

// Use flag
if (isFeatureEnabledForUser(userId)) {
  // New feature code path
  return executeNewFeature();
} else {
  // Legacy code path
  return executeLegacyFeature();
}
```

**React Admin Panel**:
```typescript
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

function MyComponent() {
  const { isEnabled, loading } = useFeatureFlag("my_feature.enabled");
  
  if (loading) return <Spinner />;
  
  if (isEnabled) {
    return <NewFeature />;
  } else {
    return <LegacyFeature />;
  }
}
```

#### 3. Document Flag

Add entry to this document (`/docs/flags.md`) with:
- Purpose
- Default value
- Impact
- Dependencies
- Metrics

#### 4. Test Flag

```typescript
// Unit test
Deno.test("feature respects flag", async () => {
  // Mock flag OFF
  mockSetting("my_feature.enabled", "false");
  const result = await executeFeature();
  assertEquals(result, "legacy");
  
  // Mock flag ON
  mockSetting("my_feature.enabled", "true");
  const result2 = await executeFeature();
  assertEquals(result2, "new");
});
```

#### 5. Monitor Flag

Add metrics:
```typescript
if (isEnabled) {
  await recordMetric("my_feature.used", 1, { user_id: userId });
  // Execute feature
} else {
  await recordMetric("my_feature.disabled", 1, { user_id: userId });
}
```

---

## Best Practices

### DO's ✅

- **Default OFF**: All new flags start disabled in production
- **Document**: Every flag has purpose, impact, and owner
- **Monitor**: Track usage and impact metrics
- **Test**: Both enabled and disabled code paths
- **Clean Up**: Remove flags after full launch (within 2 weeks)
- **Use Descriptive Names**: `feature_name.enabled`, not `flag123`

### DON'Ts ❌

- **No Permanent Flags**: Flags are temporary (except infrastructure)
- **No Nested Flags**: Avoid `if flagA && flagB` (complex dependencies)
- **No Feature Bloat**: Keep flag checks close to feature code
- **No Secret Flags**: Document all flags publicly
- **No Disable-Only**: Flags should enable features, not disable them

---

## Flag Lifecycle

```
1. Created (default OFF)
   ↓
2. Internal Testing (team only)
   ↓
3. Beta Rollout (10% users)
   ↓
4. Gradual Rollout (25% → 50% → 75%)
   ↓
5. Full Launch (100% users)
   ↓
6. Remove Flag (after 2 weeks stable)
```

---

## Emergency Shutoff

### Scenario: Critical Bug Discovered

**Action**:
```sql
-- Immediate disable
UPDATE settings SET value = 'false' WHERE key = 'buggy_feature.enabled';
```

**Communication**:
1. Post in #incidents Slack channel
2. Update status page
3. Notify users if needed
4. Schedule hotfix

**Recovery**:
1. Fix bug in staging
2. Test thoroughly
3. Re-enable flag for internal users
4. Gradual re-rollout if safe

---

## Flag Audit

**Frequency**: Monthly

**Steps**:
1. List all flags in database
2. Identify flags at 100% rollout for > 2 weeks
3. Create tickets to remove old flags
4. Update documentation

**Query**:
```sql
SELECT 
  key,
  value,
  metadata->>'launched_at' AS launched_at,
  metadata->>'rollout_percentage' AS rollout_pct,
  updated_at
FROM settings
WHERE key LIKE '%.enabled'
  AND value = 'true'
  AND metadata->>'rollout_percentage' = '100'
  AND metadata->>'launched_at' IS NOT NULL
  AND (metadata->>'launched_at')::timestamptz < NOW() - INTERVAL '14 days'
ORDER BY key;
```

---

## References

- [Feature Flag Best Practices](https://martinfowler.com/articles/feature-toggles.html)
- [LaunchDarkly Flag Types](https://docs.launchdarkly.com/home/flags/variations)
- [Split.io Best Practices](https://help.split.io/hc/en-us/articles/360020448791-Best-practices)

---

**Last Updated**: 2025-10-28  
**Owner**: easyMO Engineering Team  
**Review Cycle**: Monthly
