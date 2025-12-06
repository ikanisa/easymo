# Voice Calls Configuration Guide

## OpenAI Realtime API Configuration

### Account Details

| Setting | Value |
|---------|-------|
| **Organization ID** | `org-4Kr7lOqpDhJErYgyGzwgSduN` |
| **Project ID** | `proj_BL7HHgepm76lhElLqmfOckIU` |
| **Webhook Secret** | `whsec_7B7U3XqU7ZuFzUvBauNsYDITpdGbPXcIAavH1XtH9d4=` |

### SIP URI for Carriers

```
sip:proj_BL7HHgepm76lhElLqmfOckIU@sip.api.openai.com;transport=tls
```

### Webhook Endpoint

```
https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/openai-sip-webhook
```

---

## Environment Variables

Set these in Supabase Edge Functions:

```bash
# OpenAI Configuration
supabase secrets set OPENAI_ORG_ID="org-4Kr7lOqpDhJErYgyGzwgSduN"
supabase secrets set OPENAI_PROJECT_ID="proj_BL7HHgepm76lhElLqmfOckIU"
supabase secrets set OPENAI_WEBHOOK_SECRET="whsec_7B7U3XqU7ZuFzUvBauNsYDITpdGbPXcIAavH1XtH9d4="
supabase secrets set OPENAI_REALTIME_MODEL="gpt-4o-realtime-preview-2024-12-17"
```

---

## SIP Trunk Configuration

### MTN Rwanda

| Setting | Value |
|---------|-------|
| SIP URI | `sip:proj_BL7HHgepm76lhElLqmfOckIU@sip.api.openai.com;transport=tls` |
| Transport | TLS |
| Port | 5061 |
| Codecs | G.711 (PCMU/PCMA), Opus |
| DID Numbers | +250788XXXXXX |

### GO Malta

| Setting | Value |
|---------|-------|
| SIP URI | `sip:proj_BL7HHgepm76lhElLqmfOckIU@sip.api.openai.com;transport=tls` |
| Transport | TLS |
| Port | 5061 |
| Codecs | G.711 (PCMU/PCMA), Opus |
| DID Numbers | +356XXXXXXXX |

---

## Architecture

```
Phone Call Flow (SIP):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ User dials   │────►│ MTN/GO SIP   │────►│ OpenAI SIP   │────►│ OpenAI sends │
│ +250788xxxxx │     │ Trunk        │     │ Endpoint     │     │ webhook      │
└──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                       │
                                                                       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────────┐
│ User hears   │◄────│ OpenAI       │◄────│ openai-sip-webhook Edge Function │
│ AI response  │     │ Realtime API │     │ Accepts call + configures AI     │
└──────────────┘     └──────────────┘     └──────────────────────────────────┘

WhatsApp Voice Call Flow:
┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────────┐
│ User taps 📞 │────►│ WhatsApp     │────►│ wa-webhook-voice-calls           │
│ in WhatsApp  │     │ Business API │     │ Edge Function                    │
└──────────────┘     └──────────────┘     └──────────────┬───────────────────┘
                                                          │
                                                          ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────────┐
│ User hears   │◄────│ OpenAI       │◄────│ Returns audio config to WhatsApp │
│ AI response  │     │ Realtime API │     │ Direct WebSocket connection      │
└──────────────┘     └──────────────┘     └──────────────────────────────────┘
```

---

## Deployment Commands

```bash
# Deploy Edge Functions
supabase functions deploy wa-webhook-voice-calls
supabase functions deploy openai-sip-webhook

# Verify deployment
supabase functions list
```

---

## Testing

### Test WhatsApp Voice Call
1. Open WhatsApp on your phone
2. Go to EasyMO business chat
3. Tap the phone icon 📞
4. Select "Voice Call"
5. AI should answer and greet you

### Test Phone Call (When SIP Ready)
1. Call your EasyMO DID number
2. OpenAI receives call via SIP
3. Webhook fires to your endpoint
4. AI answers and assists caller

---

## Troubleshooting

### Check Edge Function Logs
```bash
supabase functions logs wa-webhook-voice-calls
supabase functions logs openai-sip-webhook
```

### Verify Secrets
```bash
supabase secrets list
```

### Test Webhook Manually
```bash
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/openai-sip-webhook/health
```

---

**Last Updated:** 2025-12-06
**Configuration Status:** ✅ Complete