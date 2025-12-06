# Intent Matching Updates - Time Window & Opt-Out

**Date:** 2025-12-06 12:42:00 UTC  
**Status:** ✅ DEPLOYED TO PRODUCTION

---

## 🎯 What Was Added

### 1. Time Window Limit (24 Hours) ✅
- Intent matching now only processes intents created within the last 24 hours
- Older intents are automatically expired
- Cron job runs hourly to expire old intents

### 2. Opt-Out Button ✅
- WhatsApp notifications now include "🔕 Stop notifications" button
- Users can opt out with one click
- Opt-out preferences stored in database
- Users can re-subscribe by replying "SUBSCRIBE"

---

## 📊 Implementation Details

### Time Window (24 Hours)

**Query Filter Added:**
```typescript
const twentyFourHoursAgo = new Date();
twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

// Only process intents from last 24 hours
.gte('created_at', twentyFourHoursAgo.toISOString())
```

**Auto-Expiration:**
- Cron job: `expire-old-intents-hourly`
- Schedule: Every hour at minute 0
- Function: `public.expire_old_intents()`
- Expires intents older than 24 hours

### Opt-Out System

**New Database Table:**
```sql
CREATE TABLE intent_notification_preferences (
  phone_number TEXT NOT NULL UNIQUE,
  notifications_enabled BOOLEAN DEFAULT true,
  opted_out_at TIMESTAMPTZ,
  opted_out_reason TEXT,
  can_resubscribe BOOLEAN DEFAULT true
);
```

**Helper Functions:**
1. `user_has_notifications_enabled(phone)` - Check if enabled
2. `opt_out_intent_notifications(phone, reason)` - Opt out user
3. `opt_in_intent_notifications(phone)` - Opt in user

**Interactive Button:**
```json
{
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Match results..." },
    "action": {
      "buttons": [{
        "type": "reply",
        "reply": {
          "id": "stop_notifications_{intent_id}",
          "title": "🔕 Stop notifications"
        }
      }]
    }
  }
}
```

---

## 🔔 Updated Notification Flow

### Before Sending Notification:
1. Check `intent_notification_preferences` table
2. If `notifications_enabled = false`, skip notification
3. Mark intent as 'matched' (not 'notified')
4. Log event: `INTENT_NOTIFICATION_SKIPPED`

### Notification Format:
```
🏠 *Great news!* We found properties in Kimironko:

1️⃣ *2BR Rental in Kimironko*
   📍 Near Simba Supermarket
   💰 280,000 RWF/month

💬 Reply "more" to see all options

[Button: 🔕 Stop notifications]
```

### User Clicks "Stop notifications":
1. WhatsApp sends button callback
2. System calls `opt_out_intent_notifications(phone)`
3. Sets `notifications_enabled = false`
4. Cancels pending intents for that user
5. Sends confirmation: "You will no longer receive match notifications. Reply SUBSCRIBE to opt back in."

### User Re-Subscribes:
1. User replies "SUBSCRIBE"
2. System calls `opt_in_intent_notifications(phone)`
3. Sets `notifications_enabled = true`
4. Sends confirmation: "You are now subscribed to match notifications."

---

## 🧪 Testing

### Test Time Window (24 Hours)
```sql
-- Create old intent (should be expired)
INSERT INTO user_intents (phone_number, intent_type, location_text, details, created_at)
VALUES ('+250788123456', 'property_seeker', 'Kigali', '{"bedrooms": 2}', now() - interval '25 hours');

-- Run expiration function
SELECT expire_old_intents();

-- Verify status changed to 'expired'
SELECT status FROM user_intents WHERE phone_number = '+250788123456';
-- Expected: 'expired'
```

### Test Opt-Out
```sql
-- Opt out user
SELECT opt_out_intent_notifications('+250788123456', 'Testing');

-- Verify preference
SELECT notifications_enabled FROM intent_notification_preferences 
WHERE phone_number = '+250788123456';
-- Expected: false

-- Create new intent for opted-out user
INSERT INTO user_intents (phone_number, intent_type, location_text, details)
VALUES ('+250788123456', 'property_seeker', 'Kigali', '{"bedrooms": 2}');

-- Wait for matching (5 min)
-- Expected: Intent marked as 'matched' but NO notification sent
```

### Test Opt-In
```sql
-- Opt in user
SELECT opt_in_intent_notifications('+250788123456');

-- Verify preference
SELECT notifications_enabled FROM intent_notification_preferences 
WHERE phone_number = '+250788123456';
-- Expected: true
```

---

## 📊 Monitoring

### Check Opt-Out Stats
```sql
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE notifications_enabled = false) as opted_out,
  COUNT(*) FILTER (WHERE notifications_enabled = true) as enabled
FROM intent_notification_preferences;
```

### Check Expired Intents
```sql
SELECT 
  COUNT(*) as expired_intents,
  DATE(created_at) as creation_date
FROM user_intents
WHERE status = 'expired'
GROUP BY DATE(created_at)
ORDER BY creation_date DESC;
```

### Check Skipped Notifications
```sql
-- From structured logs
SELECT * FROM logs 
WHERE event = 'INTENT_NOTIFICATION_SKIPPED'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔄 Cron Jobs Status

| Job Name | Schedule | Description |
|----------|----------|-------------|
| process-user-intents-every-5min | */5 * * * * | Match intents and send notifications |
| expire-old-intents-hourly | 0 * * * * | Expire intents older than 24 hours |

**Verify:**
```sql
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE '%intent%';
```

---

## 📝 Updated Files

### Database Migration
- `20251206123000_intent_notifications_optout.sql` (NEW)
  - Created `intent_notification_preferences` table
  - Added 4 helper functions
  - Added hourly expiration cron job

### Edge Function
- `process-user-intents/index.ts` (UPDATED)
  - Added 24-hour time window filter
  - Added opt-out preference check
  - Changed notification to interactive button
  - Added skip logic for opted-out users

---

## ✅ Deployment Checklist

- [x] Database migration applied
- [x] intent_notification_preferences table created
- [x] 4 helper functions created
- [x] Hourly expiration cron job scheduled
- [x] Edge function updated with time window
- [x] Edge function updated with opt-out check
- [x] Interactive button added to notifications
- [x] Edge function redeployed
- [x] Verification completed

---

## 🎯 Summary

**Time Window:**
- ✅ Only processes intents from last 24 hours
- ✅ Auto-expires old intents hourly
- ✅ Reduces noise from stale requests

**Opt-Out:**
- ✅ One-click opt-out button in notifications
- ✅ Preferences stored in database
- ✅ Can re-subscribe anytime
- ✅ Pending intents cancelled on opt-out

**User Experience:**
- Better: Users see button to stop notifications
- Better: No spam from old requests
- Better: Can control notification preferences
- Better: Clear feedback on opt-in/opt-out

---

**Deployed By:** AI Agent  
**Deployment Time:** 2025-12-06 12:42:00 UTC  
**Status:** ✅ LIVE IN PRODUCTION
