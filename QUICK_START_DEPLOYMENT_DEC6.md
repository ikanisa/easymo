# 🚀 Quick Start - December 6, 2025 Deployment

## Summary
✅ **Waiter AI** - Production Ready  
⏳ **Voice Calls** - Needs SIP Setup  
✅ **Call Center AGI** - Production Ready

---

## Waiter AI - Test Now! 🍽️

### Test URLs
**Rwanda Bar:**
```
https://wa.me/250788123456?text=TABLE-A5-BAR-{your_bar_uuid}
```

**Malta Bar:**
```
https://wa.me/35699123456?text=TABLE-B2-BAR-{your_bar_uuid}
```

### Test Commands
1. "Show menu"
2. "I want 2 beers"
3. "Checkout"
4. Rwanda: Get MoMo USSD code
5. Malta: Get Revolut link

---

## Voice Calls - Setup Required 📞

### Step 1: Configure SIP Trunk
1. Go to Twilio (or SIP provider)
2. Purchase phone number
3. Point to: `sip:proj_BL7HHgepm76lhElLqmfOckIU@sip.api.openai.com;transport=tls`

### Step 2: OpenAI Webhook
1. Visit: https://platform.openai.com/settings/organization/webhooks
2. Create webhook
3. URL: `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-voice-calls`
4. Event: `realtime.call.incoming`
5. Secret: Already set (`OPENAI_WEBHOOK_SECRET`)

### Step 3: WhatsApp Business
1. Meta Developer Console
2. Enable voice calls on your number
3. Set webhook: Same as Step 2

---

## Call Center AGI - Working Now! 🤖

### Test WhatsApp
```
Send message to your WhatsApp number:
"I need a ride to the airport"
```

AI will:
- Use GPT-4o (primary)
- Access 20+ tools
- Respond in user's language
- Log all interactions

---

## Monitoring

### Supabase Dashboard
https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/logs

### Filter Functions
- `wa-webhook-waiter`
- `wa-webhook-voice-calls`
- `wa-agent-call-center`

---

## Rollback (If Needed)

```bash
git revert 6597bb1e
git revert 4a2775dc
git push origin main
supabase functions deploy wa-webhook-waiter
```

---

## Support
- Full Deployment Doc: `DEPLOYMENT_COMPLETE_2025_12_06_FINAL.md`
- GitHub: https://github.com/ikanisa/easymo
- Supabase: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt
