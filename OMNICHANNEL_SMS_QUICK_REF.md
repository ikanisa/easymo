# Omnichannel SMS System - Quick Reference

## 🎯 What It Does

Unifies **Voice**, **WhatsApp**, and **SMS** into one continuous conversation:
- After every voice call (SIP or WhatsApp), users receive a summary via WhatsApp + SMS (or SMS only)
- Users can reply via **any channel** and continue the same conversation
- AI remembers context across all channels

## 📋 Quick Deploy

```bash
# Apply migration + deploy functions
./deploy-omnichannel-sms.sh

# Set environment variables in Supabase Dashboard
MTN_SMS_API_KEY=your-key
MTN_SMS_API_SECRET=your-secret
MTN_SMS_SENDER_ID=EasyMO

# Configure MTN webhook
URL: https://your-project.supabase.co/functions/v1/sms-inbound-webhook
Method: POST
Headers: Authorization: Bearer YOUR_SUPABASE_ANON_KEY
```

## 🔧 Integration Points

### 1. Trigger Post-Call Summary (Add to voice call handlers)

**In `wa-webhook-voice-calls/index.ts`:**
```typescript
// After call ends
await supabase.functions.invoke('post-call-notify', {
  body: {
    callId: callSummary.id,
    profileId: profile.user_id,
    phoneNumber: fromNumber,
  }
});
```

**In `openai-sip-webhook/index.ts`:**
```typescript
// After session.stop()
await supabase.functions.invoke('post-call-notify', {
  body: {
    callId: callSummaryId,
    profileId: profile.user_id,
    phoneNumber: phoneNumber,
  }
});
```

### 2. Update Call Center AGI Tools (Add to tool catalog)

**In `wa-agent-call-center/call-center-agi.ts`:**
```typescript
import { MESSAGING_TOOLS } from '../_shared/tools/messaging-tools.ts';

// Add to existing tools array
const tools = [
  ...existingTools,
  ...MESSAGING_TOOLS,
];
```

### 3. Update Call Center AGI System Instructions

Add this block to system instructions:

```
# POST-CALL SUMMARY & TEXT FOLLOW-UP

At the end of EVERY call:
1. Create 3-5 bullet point summary
2. Call session_get_or_create(profile_id, call_id) → get session_id
3. Try messaging_send_whatsapp(profile_id, session_id, summary)
4. Always call messaging_send_sms(profile_id, session_id, summary)
5. Keep summary concise for SMS (no markdown, minimal emojis)

When user replies via SMS or WhatsApp:
- Assume they reference the last call
- Continue conversation with full context
```

## 📊 Database Tables

### `omnichannel_sessions`
Unified sessions across channels
```sql
SELECT id, profile_id, primary_channel, active_channels, status, last_agent_id
FROM omnichannel_sessions
WHERE profile_id = 'user-uuid'
ORDER BY updated_at DESC;
```

### `message_delivery_log`
All message delivery tracking
```sql
SELECT channel, direction, status, content, created_at
FROM message_delivery_log
WHERE profile_id = 'user-uuid'
ORDER BY created_at DESC
LIMIT 20;
```

### `profiles` (extended)
```sql
SELECT 
  phone_number,
  whatsapp_jid,
  has_whatsapp,
  allows_sms,
  last_active_channel,
  notification_preferences
FROM profiles
WHERE user_id = 'user-uuid';
```

## 🧪 Test Scenarios

### Test 1: SMS-Only User
```
1. User calls via regular phone (SIP)
2. Call ends → receives SMS summary
3. User replies via SMS: "Change budget to 200k"
4. AI responds via SMS with context
```

### Test 2: WhatsApp User
```
1. User calls via WhatsApp voice
2. Call ends → receives WhatsApp + SMS summary
3. User replies via WhatsApp: "When will I hear back?"
4. AI responds via WhatsApp maintaining context
```

### Test 3: Cross-Channel
```
1. User calls via phone
2. Receives SMS summary
3. Replies via WhatsApp (if they have it)
4. AI recognizes same user/session
5. Continues conversation via WhatsApp
```

### Test 4: Direct SMS (No Call)
```
1. User sends SMS: "I want to rent a house"
2. AI creates new session
3. Continues conversation via SMS
4. Same tools/logic as voice calls
```

## 🔍 Monitoring Queries

### Active Sessions
```sql
SELECT 
  s.id,
  p.phone_number,
  s.primary_channel,
  s.active_channels,
  s.status,
  s.last_agent_id,
  s.updated_at
FROM omnichannel_sessions s
JOIN profiles p ON s.profile_id = p.user_id
WHERE s.status IN ('active', 'follow_up')
ORDER BY s.updated_at DESC;
```

### Message Delivery Stats (Last 24h)
```sql
SELECT 
  channel,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'failed') as failures
FROM message_delivery_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY channel, status;
```

### Failed Deliveries
```sql
SELECT 
  channel,
  recipient_phone,
  error_message,
  retry_count,
  created_at
FROM message_delivery_log
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

## 🚨 Troubleshooting

### SMS Not Received
1. Check `message_delivery_log` for errors
2. Verify MTN credentials in env vars
3. Check MTN API rate limits
4. Verify phone number is valid Rwanda format (+250...)

### WhatsApp Not Sent
1. Check `has_whatsapp` flag in profiles
2. Verify `whatsapp_jid` is set
3. Check WhatsApp API circuit breaker status
4. Review structured logs for WHATSAPP_SEND_FAILED

### Context Lost
1. Check `omnichannel_sessions` - is there an active session?
2. Verify session_id is passed in messages
3. Check if session expired (>24h old)
4. Review `last_agent_id` and `last_intent` fields

### SMS Inbound Not Working
1. Verify MTN webhook is configured correctly
2. Check webhook URL is accessible
3. Test with: `curl -X POST your-webhook-url -d '...'`
4. Review structured logs for SMS_INBOUND_RECEIVED

## 📝 Message Format Guidelines

### WhatsApp (Rich)
```
📞 EasyMO Call Summary:

✓ Registered your property in Kigali
• Location: Kicukiro, near KG 123 St
• Budget: 300,000 RWF/month
• Bedrooms: 2

➡️ Next: We'll send tenant matches soon

Reply to continue!
```

### SMS (Concise)
```
EasyMO summary:
1) Property registered in Kigali
2) Budget: 300k RWF/month
3) We'll send matches soon
Reply to continue
```

## 🔗 Related Documentation

- Full Implementation: `OMNICHANNEL_SMS_IMPLEMENTATION.md`
- Database Migration: `supabase/migrations/20251207010000_omnichannel_sms_system.sql`
- Dual-Channel Service: `supabase/functions/_shared/notifications/dual-channel.ts`
- Post-Call Handler: `supabase/functions/post-call-notify/index.ts`
- SMS Webhook: `supabase/functions/sms-inbound-webhook/index.ts`
- Messaging Tools: `supabase/functions/_shared/tools/messaging-tools.ts`

## 📊 Success Metrics

Track these KPIs:
- **Delivery Rate**: Target >95%
- **Cross-Channel Usage**: % users using multiple channels
- **Session Continuity**: % SMS/WA replies linked to calls
- **Response Time**: Call end → summary delivery (<10s)

## 🎯 Key Features

✅ No user left behind (SMS fallback)
✅ One conversation across all channels
✅ AI maintains full context
✅ Automatic summary after every call
✅ Reply via any channel
✅ Smart routing based on availability
✅ Rich formatting for WhatsApp
✅ Concise formatting for SMS
✅ Full delivery tracking
✅ RLS security policies
✅ Circuit breaker protection
✅ Retry logic for SMS
✅ Structured observability

---

**Need Help?** Check structured logs in Supabase Dashboard → Edge Functions → Logs

**Quick Test:**
```bash
# Test post-call notification
curl -X POST "$SUPABASE_URL/functions/v1/post-call-notify" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"callId": "your-call-id"}'
```
