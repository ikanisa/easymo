# BUY & SELL FIXES - CHANGES SUMMARY

**Date**: December 11, 2025  
**Files Changed**: 2  
**Lines Added**: 36  
**Lines Modified**: 2  

---

## 📝 CHANGES MADE

### File 1: `supabase/functions/wa-webhook-buy-sell/index.ts`

**Changes**: Added observability metrics (3 locations)

#### Change 1: Track button-based AI exits (lines 284-290)
```typescript
// Track AI exit metric
await recordMetric("buy_sell.ai_session_exit", 1, {
  reason: "user_button",
  buttonId,
});
```
**Why**: Track when users exit AI mode via buttons (back_home, exit_ai, etc.)

#### Change 2: Track keyword-based AI exits (lines 352-358)
```typescript
// Track AI exit metric
await recordMetric("buy_sell.ai_session_exit", 1, {
  reason: "user_keyword",
  keyword: lower,
});
```
**Why**: Track when users exit AI mode by typing menu/home/stop/exit

#### Change 3: Track AI session timeouts (lines 400-406)
```typescript
// Track AI timeout metric
await recordMetric("buy_sell.ai_session_exit", 1, {
  reason: "timeout",
  duration_ms: elapsed,
});
```
**Why**: Track when AI sessions expire after 30 minutes

#### Change 4: Track button taps in AI mode (lines 433-443)
```typescript
await logStructuredEvent("BUY_SELL_NON_TEXT_IN_AI_MODE", {
  userId: profile.user_id,
  messageType: message.type,
  buttonId: message.type === "interactive" ? message.interactive?.button_reply?.id : undefined,
}, "warn");

// Track user frustration metric
await recordMetric("buy_sell.button_tap_in_ai_mode", 1, {
  messageType: message.type,
  sessionDuration: elapsed,
});
```
**Why**: Track user frustration (tapping buttons while in AI text-only mode)

---

### File 2: `supabase/functions/wa-webhook-buy-sell/show_ai_welcome.ts`

**Changes**: 
1. Fixed type error (ensureProfile returns object, not string)
2. Added AI session start tracking

#### Change 1: Fix ensureProfile usage (lines 21-22)
```typescript
// BEFORE:
const profileId = await ensureProfile(supabase, userPhone, userCountry);
if (profileId) {
  await setState(supabase, profileId, {...});

// AFTER:
const profile = await ensureProfile(supabase, userPhone);
if (profile?.user_id) {
  await setState(supabase, profile.user_id, {...});
```
**Why**: Type safety - ensureProfile returns ProfileRecord object

#### Change 2: Track AI session starts (lines 32-40)
```typescript
// Track AI session start
await import("../_shared/observability.ts").then(({ recordMetric }) => {
  recordMetric("buy_sell.ai_session_start", 1, {
    country: userCountry,
  });
});
```
**Why**: Track when users enter AI mode (for session analytics)

---

## 📊 NEW METRICS AVAILABLE

After deployment, these metrics will be available:

### 1. `buy_sell.ai_session_start`
**What it tracks**: Users entering AI mode  
**Labels**: `country`  
**Query example**:
```sql
SELECT COUNT(*) as ai_sessions
FROM metrics 
WHERE name = 'buy_sell.ai_session_start'
AND timestamp > NOW() - INTERVAL '24 hours';
```

### 2. `buy_sell.ai_session_exit`
**What it tracks**: Users exiting AI mode  
**Labels**: `reason` (user_button | user_keyword | timeout), `buttonId`, `keyword`, `duration_ms`  
**Query example**:
```sql
SELECT 
  labels->>'reason' as exit_method,
  COUNT(*) as count
FROM metrics 
WHERE name = 'buy_sell.ai_session_exit'
GROUP BY exit_method;
```

### 3. `buy_sell.button_tap_in_ai_mode`
**What it tracks**: Users trying buttons in AI text-only mode (frustration indicator)  
**Labels**: `messageType`, `sessionDuration`  
**Query example**:
```sql
SELECT COUNT(*) as frustrated_attempts
FROM metrics 
WHERE name = 'buy_sell.button_tap_in_ai_mode'
AND timestamp > NOW() - INTERVAL '24 hours';
```

---

## 🎯 WHAT THIS SOLVES

### Problem 1: Couldn't track AI adoption
**Before**: No metrics for AI mode usage  
**After**: `buy_sell.ai_session_start` tracks entries ✅

### Problem 2: Couldn't measure exit success
**Before**: No data on how users exit AI  
**After**: `buy_sell.ai_session_exit` with reason labels ✅

### Problem 3: Couldn't detect user frustration
**Before**: Users getting stuck, no visibility  
**After**: `buy_sell.button_tap_in_ai_mode` detects frustration ✅

### Problem 4: Couldn't measure session duration
**Before**: No duration data  
**After**: Timeout exits include `duration_ms` ✅

---

## ✅ VERIFICATION CHECKLIST

Before deploying, verify:

- [x] All 4 critical fixes present (from audit)
  - [x] Share button handler
  - [x] Back/Exit button handlers  
  - [x] Keyword escape mechanism
  - [x] Don't forward buttons to AI
  - [x] 30-minute timeout
  - [x] Exit button in AI welcome

- [x] New observability added
  - [x] Session start tracking
  - [x] Session exit tracking (3 reasons)
  - [x] Button tap frustration tracking
  - [x] Enhanced log events

- [x] Type errors fixed
  - [x] ensureProfile usage corrected

- [ ] Manual testing (post-deployment)
  - [ ] Enter AI, tap Share → gets referral link
  - [ ] Enter AI, tap Exit → returns to categories
  - [ ] Enter AI, type "menu" → returns to categories
  - [ ] Enter AI, send location → gets helpful message
  - [ ] Check metrics in database

---

## 🚀 DEPLOYMENT COMMANDS

### 1. Deploy to Supabase
```bash
# Deploy the buy-sell webhook function
supabase functions deploy wa-webhook-buy-sell

# Or deploy all functions
supabase functions deploy
```

### 2. Monitor After Deployment
```bash
# Watch logs
supabase functions logs wa-webhook-buy-sell --follow

# Check for specific events
supabase functions logs wa-webhook-buy-sell | grep "BUY_SELL_AI_STATE_CLEARED"
supabase functions logs wa-webhook-buy-sell | grep "BUY_SELL_NON_TEXT_IN_AI_MODE"
```

### 3. Query Metrics
```sql
-- AI session activity (last 24h)
SELECT 
  name,
  COUNT(*) as count
FROM metrics
WHERE name LIKE 'buy_sell.ai_%'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY name;

-- Exit method distribution
SELECT 
  labels->>'reason' as exit_method,
  COUNT(*) as count,
  ROUND(AVG((labels->>'duration_ms')::numeric) / 1000 / 60, 1) as avg_minutes
FROM metrics
WHERE name = 'buy_sell.ai_session_exit'
GROUP BY exit_method;

-- Frustration rate
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as frustrated_taps
FROM metrics
WHERE name = 'buy_sell.button_tap_in_ai_mode'
GROUP BY date
ORDER BY date DESC;
```

---

## 📈 SUCCESS CRITERIA

### Week 1 Post-Deployment
- ✅ Share button complaints drop to zero
- ✅ "Stuck in AI mode" tickets drop by 95%
- ✅ `buy_sell.button_tap_in_ai_mode` < 5% of sessions
- ✅ `buy_sell.ai_session_exit` shows healthy distribution

### Week 2 Post-Deployment
- ✅ User satisfaction scores improve
- ✅ Session completion rate increases
- ✅ Average session duration decreases (less frustration)

### Month 1 Post-Deployment
- ✅ AI adoption rate tracked and growing
- ✅ Exit patterns understood
- ✅ No critical bugs reported
- ✅ Ready for short-term improvements (mode indicators, better errors)

---

## 🔧 ROLLBACK PLAN

If critical issues occur:

```bash
# 1. Revert to previous version
git revert <commit-hash>

# 2. Redeploy
supabase functions deploy wa-webhook-buy-sell

# 3. Notify users (if needed)
# Send WhatsApp message about temporary issues

# 4. Investigate
supabase functions logs wa-webhook-buy-sell --limit 1000 > issue-logs.txt
```

---

## 📞 SUPPORT & MONITORING

### Dashboard Alerts (Recommended)

Set up alerts for:
- `buy_sell.button_tap_in_ai_mode` > 100/hour → High frustration
- `buy_sell.ai_session_exit` with reason="timeout" > 50% → Sessions too long
- Error rate > 5% → System issues

### Manual Checks (Daily)

```bash
# Check for errors
supabase functions logs wa-webhook-buy-sell | grep "ERROR"

# Check metric counts
psql $DATABASE_URL -c "SELECT name, COUNT(*) FROM metrics WHERE name LIKE 'buy_sell%' AND timestamp > NOW() - INTERVAL '1 day' GROUP BY name;"

# Check state clearing
supabase functions logs wa-webhook-buy-sell | grep "BUY_SELL_AI_STATE_CLEARED" | wc -l
```

---

**Changes Summary**: ✅ **2 files, 36 lines added, minimal risk**  
**Impact**: 📊 **Full observability for buy/sell AI sessions**  
**Status**: 🚀 **READY TO DEPLOY**
