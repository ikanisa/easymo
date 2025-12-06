# 🚀 Quick Start Deployment Guide

## Waiter AI (Restaurant Service)

### Deploy
```bash
supabase functions deploy wa-webhook-waiter
```

### Test
Send WhatsApp message with QR code format:
```
https://wa.me/YOUR_NUMBER?text=TABLE-A5-BAR-abc123
```

### Verify
- ✅ Session created in `waiter_conversations`
- ✅ Menu displayed
- ✅ Orders in `orders` table
- ✅ Bar owner notified

---

## Voice Calls (Real-time AI)

### Deploy
```bash
./deploy-voice-calls.sh
```

### Configure OpenAI
1. Go to: https://platform.openai.com/settings/organization/webhooks
2. Add endpoint:
   - URL: `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/openai-sip-webhook`
   - Events: `realtime.call.incoming`, `realtime.call.ended`
   - Secret: `whsec_7B7U3XqU7ZuFzUvBauNsYDITpdGbPXcIAavH1XtH9d4=`

### Configure WhatsApp
1. Go to: Facebook Developer Console → WhatsApp → Phone Numbers
2. Set SIP URI: `sip:proj_BL7HHgepm76lhElLqmfOckIU@sip.api.openai.com;transport=tls`

### Test
Call your WhatsApp Business number and talk to AI.

### Verify
- ✅ Call answered within 2 seconds
- ✅ AI responds in real-time
- ✅ Call logged in `call_summaries`

---

## Environment Variables
All configured ✅ - No action needed.

## Documentation
- **Full guide**: VOICE_CALLS_DEPLOYMENT_READY.md
- **Architecture**: VOICE_CALLS_IMPLEMENTATION_AUDIT.md
- **Session notes**: SESSION_SUMMARY_2025_12_06_VOICE_WAITER.md

## Support
Check Supabase logs:
```bash
supabase functions logs <function-name> --follow
```
