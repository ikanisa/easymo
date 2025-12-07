# Omni-Channel Notification System - Quick Start

## What This Implements

After any voice call (SIP or WhatsApp), the system automatically:
1. ✅ Sends conversation summary to **WhatsApp** (if user has it)
2. ✅ Sends conversation summary via **SMS** (always, as fallback)
3. ✅ Allows users to reply and continue conversation on **either channel**
4. ✅ Maintains session context across **all channels** (voice/WhatsApp/SMS)

## Files Created

### Database Migrations
- `supabase/migrations/20251207000000_omnichannel_notification_system.sql`
  - Extends `profiles` table (whatsapp_jid, has_whatsapp, allows_sms, last_active_channel)
  - Creates `omnichannel_sessions` table (session tracking across channels)
  - Creates `message_delivery_log` table (delivery audit trail)
  - Adds helper functions (get_or_create_session, update_status, log_delivery)

- `supabase/migrations/20251207000001_call_center_omnichannel_tools.sql`
  - Updates Call Center AGI system instructions with post-call summary rules
  - Adds 7 messaging/session tools to Call Center AGI

### Supabase Edge Functions
- `supabase/functions/post-call-notify/index.ts`
  - Triggered on call termination
  - Sends dual-channel summary
  - Creates/updates omnichannel sessions

- `supabase/functions/sms-inbound-webhook/index.ts`
  - Handles incoming SMS from MTN
  - Routes to OpenAI for AI responses
  - Maintains session continuity

### Shared Utilities
- `supabase/functions/_shared/notifications/dual-channel.ts`
  - Dual-channel notification service
  - Format helpers (WhatsApp vs SMS)

- `supabase/functions/_shared/session/omnichannel-session.ts`
  - Session management utilities
  - Context persistence functions

- `supabase/functions/_shared/tools/messaging-tools.ts`
  - AGI tools for messaging
  - 7 tools for AI agents to use

### Updated Files
- `supabase/functions/wa-webhook-voice-calls/index.ts`
  - Added trigger to post-call-notify on call termination

### Documentation
- `docs/OMNICHANNEL_NOTIFICATION_SYSTEM.md`
  - Complete implementation guide
  - Architecture overview
  - API reference
  - Testing instructions

## Quick Deploy

```bash
# 1. Apply database migrations
supabase db push

# 2. Deploy new functions
supabase functions deploy post-call-notify
supabase functions deploy sms-inbound-webhook

# 3. Redeploy updated function
supabase functions deploy wa-webhook-voice-calls

# 4. Set environment variables (Supabase Dashboard)
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_id
MTN_SMS_API_KEY=your_key
MTN_SMS_API_SECRET=your_secret
MTN_SMS_SENDER_ID=EasyMO
MTN_WEBHOOK_SECRET=your_webhook_secret
OPENAI_API_KEY=your_openai_key

# 5. Configure MTN webhook to point to:
https://your-project.supabase.co/functions/v1/sms-inbound-webhook
```

## Example Flow

```
User calls → AI handles → Call ends
     ↓
Post-call summary sent via:
  ✅ WhatsApp (rich format with emojis)
  ✅ SMS (concise plain text)
     ↓
User replies via SMS: "Change price to 250k"
     ↓
SMS webhook → Same session → AI updates → Reply via SMS
```

## Testing

### Test Post-Call Notification
```bash
curl -X POST https://your-project.supabase.co/functions/v1/post-call-notify \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"call_id": "test-id", "phone_number": "+250788123456"}'
```

### Test SMS Inbound
```bash
curl -X POST https://your-project.supabase.co/functions/v1/sms-inbound-webhook \
  -H "Content-Type: application/json" \
  -d '{"from": "+250788123456", "to": "+250788000000", "message": "Update my details"}'
```

### Check Session
```sql
SELECT * FROM omnichannel_sessions 
WHERE profile_id = (SELECT id FROM profiles WHERE phone_number = '+250788123456')
ORDER BY created_at DESC LIMIT 1;
```

## Success Criteria Met

✅ After every call, summary sent to available channels  
✅ SMS-only users get full functionality  
✅ Replies from either channel continue same session  
✅ Session context persists across channels  
✅ All deliveries logged for audit  
✅ Graceful degradation (one channel fails, other works)  

## Full Documentation

See `docs/OMNICHANNEL_NOTIFICATION_SYSTEM.md` for:
- Complete architecture details
- Database schema reference
- API documentation
- Security considerations
- Monitoring & metrics
- Future enhancements
