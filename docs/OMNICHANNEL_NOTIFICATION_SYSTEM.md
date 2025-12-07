# Omni-Channel Notification System Implementation

## Overview

The omni-channel notification system enables EasyMO to send call summaries and notifications via **both WhatsApp AND SMS** after voice calls, allowing users to continue conversations through either channel with full session context preservation.

## Architecture

### Database Schema

#### 1. Extended `profiles` table
```sql
ALTER TABLE profiles ADD COLUMN whatsapp_jid TEXT;
ALTER TABLE profiles ADD COLUMN has_whatsapp BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN allows_sms BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN last_active_channel TEXT CHECK (last_active_channel IN ('voice', 'whatsapp', 'sms'));
```

#### 2. `omnichannel_sessions` table
Tracks user sessions across voice, WhatsApp, and SMS channels with shared context.

Key columns:
- `profile_id`: Links to user profile
- `call_id`: Optional reference to originating call
- `primary_channel`: Channel that initiated session (voice/whatsapp/sms)
- `active_channels`: Array of currently active channels
- `context`: JSONB field for shared session data
- `summary_sent_whatsapp/sms`: Flags for delivery tracking
- `status`: active/closed/follow_up
- `expires_at`: Auto-expires after 24 hours (can be extended)

#### 3. `message_delivery_log` table
Audit log for all WhatsApp and SMS message deliveries.

Tracks:
- Channel (whatsapp/sms)
- Direction (outbound/inbound)
- Message type (call_summary, response, notification, etc.)
- Delivery status (pending/sent/delivered/failed/read)
- External message IDs from providers

### Supabase Edge Functions

#### 1. `post-call-notify`
**Triggered by**: `wa-webhook-voice-calls` on call termination

**Flow**:
1. Fetches call summary from `call_summaries` table
2. Gets user profile and channel preferences
3. Creates/updates `omnichannel_session` with status='follow_up'
4. Formats summary appropriately for each channel
5. Sends via WhatsApp (if available) AND SMS
6. Logs deliveries in `message_delivery_log`

**Environment Variables Required**:
- `WHATSAPP_ACCESS_TOKEN` or `WABA_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID` or `WABA_PHONE_NUMBER_ID`
- `MTN_SMS_API_KEY`
- `MTN_SMS_API_SECRET`
- `MTN_SMS_SENDER_ID` (default: 'EasyMO')

#### 2. `sms-inbound-webhook`
**Triggered by**: MTN SMS gateway on incoming SMS

**Flow**:
1. Receives SMS from MTN gateway
2. Verifies webhook signature (HMAC-SHA256)
3. Looks up profile by phone number (creates if not exists)
4. Finds or creates active `omnichannel_session`
5. Routes message to OpenAI for AI response
6. Sends AI response back via SMS
7. Logs both inbound and outbound messages

**Environment Variables Required**:
- `OPENAI_API_KEY`
- `MTN_SMS_API_KEY`
- `MTN_SMS_API_SECRET`
- `MTN_SMS_SENDER_ID`
- `MTN_WEBHOOK_SECRET` (for signature verification)

### Shared Utilities

#### 1. `_shared/notifications/dual-channel.ts`
**Purpose**: Dual-channel notification service

**Key Functions**:
- `sendDualChannelNotification()`: Sends to both WhatsApp AND SMS
- `formatForWhatsApp()`: Formats with emojis and rich text
- `formatForSMS()`: Formats as concise plain text (160-char aware)

**Features**:
- Automatic channel detection (checks `has_whatsapp`, `allows_sms`)
- Multi-segment SMS support (up to 3 segments = 480 chars)
- Automatic delivery logging to `message_delivery_log`
- Error handling with graceful degradation

#### 2. `_shared/session/omnichannel-session.ts`
**Purpose**: Session management across channels

**Key Functions**:
- `getOrCreateSession()`: Gets active session or creates new one
- `updateSessionStatus()`: Updates status (active/closed/follow_up)
- `updateSessionContext()`: Merges context data
- `getSessionContext()`: Retrieves session context
- `markSummarySent()`: Marks summary as sent for a channel
- `getActiveSession()`: Gets active session for a profile
- `closeSession()`: Closes a session

**Features**:
- Automatic session extension (24h on access)
- Context merging for continuity
- Status tracking for workflow management

#### 3. `_shared/tools/messaging-tools.ts`
**Purpose**: AGI tools for messaging and session management

**Tools Provided**:
1. `messaging_send_whatsapp`: Send WhatsApp-only message
2. `messaging_send_sms`: Send SMS-only message
3. `messaging_send_dual_channel`: Send to both channels
4. `session_get_or_create`: Get/create omnichannel session
5. `session_update_status`: Update session status
6. `session_add_context`: Add context to session
7. `session_get_context`: Retrieve session context

**Usage**:
```typescript
const result = await executeMessagingTool(
  'messaging_send_dual_channel',
  {
    message: 'Your summary here',
    subject: 'Call Summary',
    profile_id: 'uuid',
    message_type: 'call_summary'
  },
  dualChannelConfig
);
```

### Call Center AGI Integration

The Call Center AGI has been enhanced with:

1. **Updated System Instructions**:
   - POST-CALL SUMMARY RULES added to system prompt
   - Requires 3-5 bullet point summary at call end
   - Must call `session_get_or_create` and `messaging_send_dual_channel`
   - Must update session status to 'follow_up'

2. **New Tools** (7 total):
   - 3 messaging tools (WhatsApp, SMS, Dual-channel)
   - 4 session management tools (create, update status, add/get context)

3. **Example Summary Format**:
   ```
   EasyMO Call Summary:
   • Registered house for rent in Kigali
   • Budget: 300,000 RWF/month
   • Location: Kimihurura
   • We'll send tenant matches within 24 hours
   • Reply to this message if you need to update details
   ```

## Message Formatting

### WhatsApp Format
- Rich text with emojis
- Bold subject line with ✅
- Includes reply instruction with emphasis
- Example:
  ```
  *Call Summary* ✅
  
  Your call has been completed.
  
  Next steps:
  1. Check your email for confirmation
  2. Reply to update details
  
  _Reply to this message to continue the conversation_
  ```

### SMS Format
- Plain text, no emojis
- Concise (max 480 chars for 3 segments)
- Word-boundary aware splitting
- Example:
  ```
  Call Summary
  
  Your call has been completed.
  
  Next steps:
  1. Check your email for confirmation
  2. Reply to update details
  
  Reply to continue.
  ```

## Database Functions

### 1. `get_or_create_omnichannel_session()`
```sql
SELECT get_or_create_omnichannel_session(
  p_profile_id := 'uuid',
  p_primary_channel := 'voice',
  p_call_id := 'call-uuid',
  p_agent_id := 'call_center',
  p_intent := 'property_inquiry'
);
```
Returns: `session_id` (UUID)

### 2. `update_omnichannel_session_status()`
```sql
SELECT update_omnichannel_session_status(
  p_session_id := 'uuid',
  p_status := 'follow_up',
  p_context := '{"key": "value"}'::jsonb
);
```
Returns: `boolean` (success)

### 3. `log_message_delivery()`
```sql
SELECT log_message_delivery(
  p_session_id := 'uuid',
  p_profile_id := 'uuid',
  p_channel := 'sms',
  p_direction := 'outbound',
  p_message_type := 'call_summary',
  p_content := 'Message text',
  p_external_message_id := 'provider-msg-id',
  p_status := 'sent',
  p_metadata := '{}'::jsonb
);
```
Returns: `log_id` (UUID)

### 4. `cleanup_expired_omnichannel_sessions()`
```sql
SELECT cleanup_expired_omnichannel_sessions();
```
Returns: `integer` (count of closed sessions)

**Note**: Should be run as a cron job (e.g., hourly)

## Example Flow

### 1. Voice Call → Dual-Channel Summary
```
User calls → AI handles call → Call ends
        ↓
wa-webhook-voice-calls triggers post-call-notify
        ↓
post-call-notify:
  1. Fetches call summary
  2. Gets user profile
  3. Creates omnichannel_session
  4. Formats summary for WhatsApp and SMS
  5. Sends to both channels
  6. Logs deliveries
  7. Sets session status = 'follow_up'
```

### 2. SMS Reply → AI Response
```
User replies via SMS → MTN gateway → sms-inbound-webhook
        ↓
sms-inbound-webhook:
  1. Verifies signature
  2. Looks up profile
  3. Gets active session
  4. Logs inbound message
  5. Calls OpenAI for response
  6. Updates session context
  7. Sends response via SMS
  8. Logs outbound message
```

### 3. Session Context Continuity
```
Initial call context:
{
  "property_type": "house",
  "budget": 300000,
  "location": "Kimihurura"
}
        ↓
User changes budget via SMS: "Make it 250k"
        ↓
Updated context:
{
  "property_type": "house",
  "budget": 250000,
  "location": "Kimihurura",
  "last_sms_message": "Make it 250k",
  "last_sms_timestamp": "2024-12-07T10:30:00Z"
}
```

## Security Considerations

### 1. Webhook Signature Verification
- MTN webhooks verified using HMAC-SHA256
- Signature must match `MTN_WEBHOOK_SECRET`
- Invalid signatures rejected with 401

### 2. Observability
- All actions logged via `logStructuredEvent()`
- Correlation IDs tracked across requests
- PII masked in logs (phone numbers)
- Delivery status tracked in database

### 3. Rate Limiting
- Should implement rate limiting on SMS webhook endpoint
- Prevent spam/abuse via excessive inbound SMS

### 4. Environment Variables
- All secrets stored as environment variables
- Never exposed to client-side code
- Service role key used for internal function calls

## Deployment

### 1. Database Migration
```bash
# Apply migration
supabase db push

# Or via SQL
psql -f supabase/migrations/20251207000000_omnichannel_notification_system.sql
psql -f supabase/migrations/20251207000001_call_center_omnichannel_tools.sql
```

### 2. Deploy Functions
```bash
# Deploy post-call-notify
supabase functions deploy post-call-notify

# Deploy sms-inbound-webhook
supabase functions deploy sms-inbound-webhook

# Redeploy wa-webhook-voice-calls with updates
supabase functions deploy wa-webhook-voice-calls
```

### 3. Environment Variables
Set in Supabase Dashboard → Functions → Secrets:
```
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_id
MTN_SMS_API_KEY=your_key
MTN_SMS_API_SECRET=your_secret
MTN_SMS_SENDER_ID=EasyMO
MTN_WEBHOOK_SECRET=your_webhook_secret
OPENAI_API_KEY=your_openai_key
```

### 4. Configure MTN Webhook
Point MTN SMS inbound webhook to:
```
https://your-project.supabase.co/functions/v1/sms-inbound-webhook
```

## Testing

### 1. Test Post-Call Notification
```bash
curl -X POST https://your-project.supabase.co/functions/v1/post-call-notify \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "test-call-id",
    "phone_number": "+250788123456"
  }'
```

### 2. Test SMS Inbound
```bash
curl -X POST https://your-project.supabase.co/functions/v1/sms-inbound-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+250788123456",
    "to": "+250788000000",
    "message": "I want to change my budget to 250k"
  }'
```

### 3. Verify Session Creation
```sql
SELECT * FROM omnichannel_sessions
WHERE profile_id = (
  SELECT id FROM profiles WHERE phone_number = '+250788123456'
)
ORDER BY created_at DESC
LIMIT 1;
```

### 4. Check Message Logs
```sql
SELECT 
  channel,
  direction,
  message_type,
  status,
  created_at
FROM message_delivery_log
WHERE profile_id = (
  SELECT id FROM profiles WHERE phone_number = '+250788123456'
)
ORDER BY created_at DESC
LIMIT 10;
```

## Monitoring

### Key Metrics to Track
1. **Delivery Success Rate**: % of messages successfully sent
2. **Channel Preference**: WhatsApp vs SMS usage
3. **Session Duration**: Average time from creation to expiry
4. **Response Time**: Time from inbound SMS to outbound response
5. **Error Rate**: Failed deliveries by channel

### Logging Events
- `DUAL_CHANNEL_SEND_START/COMPLETE`
- `WHATSAPP_MESSAGE_SENT/FAILED`
- `SMS_MESSAGE_SENT/FAILED`
- `SESSION_GET_OR_CREATE_SUCCESS`
- `SMS_INBOUND_RECEIVED/RESPONSE_SENT`
- `POST_CALL_NOTIFY_SUCCESS`

## Success Criteria

✅ After every call, summary sent to available channels  
✅ SMS-only users get full functionality  
✅ Replies from either channel continue same session  
✅ Session context persists across channels  
✅ All deliveries logged for audit trail  
✅ Graceful degradation (if one channel fails, other still works)  
✅ 24-hour session expiry with auto-extension on activity  

## Future Enhancements

1. **Push Notifications**: Add FCM/APNs for mobile app users
2. **Email Channel**: Extend to include email in omnichannel
3. **Rich Media**: Support images/documents in dual-channel sends
4. **User Preferences**: Allow users to opt-in/out of specific channels
5. **A/B Testing**: Test different summary formats for engagement
6. **Analytics Dashboard**: Visualize channel usage and engagement
7. **Scheduled Messages**: Support for delayed/scheduled notifications
8. **Template Management**: Database-driven message templates
