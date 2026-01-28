# Required Environment Variables for Edge Functions

## Core Variables (Required for all webhook functions)

| Variable | Alternatives | Description |
|----------|-------------|-------------|
| `SUPABASE_URL` | `SERVICE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY`, `WA_SUPABASE_SERVICE_ROLE_KEY` | Service role key for DB access |
| `WA_PHONE_ID` | `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Phone Number ID |
| `WA_TOKEN` | `WHATSAPP_ACCESS_TOKEN` | WhatsApp API access token |
| `WA_APP_SECRET` | `WHATSAPP_APP_SECRET` | App secret for signature verification |
| `WA_VERIFY_TOKEN` | `WHATSAPP_VERIFY_TOKEN` | Webhook verification token |

## AI Provider Variables (At least one required for AI features)

| Variable | Alternatives | Description |
|----------|-------------|-------------|
| `OPENAI_API_KEY` | - | OpenAI API key for GPT models and OCR |
| `GEMINI_API_KEY` | `API_KEY` | Google Gemini API key for vision/OCR and AI agent features |

## Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `UPSTASH_REDIS_URL` | Redis URL for rate limiting | Disabled |
| `UPSTASH_REDIS_TOKEN` | Redis token | Disabled |
| `WA_ALLOW_UNSIGNED_WEBHOOKS` | Skip signature verification | `false` |
| `WA_WEBHOOK_VERIFY_TOKEN` | Webhook verification token for inbound messages | None |

## Buy & Sell Agent Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key for AI agent features | Yes |
| `WHATSAPP_BRIDGE_API_KEY` | API key for authenticating broadcast requests | Yes |
| `WA_TEMPLATE_VENDOR_OUTREACH` | WhatsApp template name for vendor outreach | No (default: `vendor_outreach`) |
| `WA_PHONE_ID` | WhatsApp Phone Number ID | Yes |
| `WA_TOKEN` | WhatsApp API access token | Yes |

## External Discovery Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `EXTERNAL_DISCOVERY_ENABLED` | Enable external discovery fallback (web/maps) | No (default: false) |
| `EXTERNAL_DISCOVERY_SERVICE_URL` | Base URL for external discovery service | No |
| `EXTERNAL_DISCOVERY_SERVICE_KEY` | Optional bearer token for discovery service | No |

## Setting Secrets

```bash
# List current secrets
supabase secrets list

# Set required secrets
supabase secrets set SUPABASE_URL=https://xxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set WA_PHONE_ID=123456789
supabase secrets set WA_TOKEN=EAAx...
supabase secrets set WA_APP_SECRET=abc123...
supabase secrets set WA_VERIFY_TOKEN=your-verify-token
supabase secrets set OPENAI_API_KEY=sk-...

# Buy & Sell Agent secrets
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set WHATSAPP_BRIDGE_API_KEY=your-bridge-api-key
supabase secrets set WA_WEBHOOK_VERIFY_TOKEN=your-webhook-token
supabase secrets set WA_TEMPLATE_VENDOR_OUTREACH=vendor_outreach
```

## Diagnostic Endpoint

Check configuration status:
```bash
curl https://YOUR_PROJECT.supabase.co/functions/v1/wa-webhook-core/config-check
```

### Example Response

```json
{
  "service": "wa-webhook-core",
  "timestamp": "2025-12-07T10:40:35.792Z",
  "environment": {
    "SUPABASE_URL": true,
    "SUPABASE_SERVICE_ROLE_KEY": true,
    "WA_PHONE_ID": true,
    "WA_TOKEN": true,
    "WA_APP_SECRET": false,
    "WA_VERIFY_TOKEN": true,
    "OPENAI_API_KEY": true,
    "GEMINI_API_KEY": false,
    "UPSTASH_REDIS_URL": false,
    "UPSTASH_REDIS_TOKEN": false
  },
  "missing": [
    "WA_APP_SECRET"
  ]
}
```

### HTTP Status Codes

- **200 OK**: All required variables are configured
- **503 Service Unavailable**: One or more required variables are missing

## Troubleshooting

### Insurance OCR returning 503

**Error**: `"no_ocr_provider"` message

**Solution**: Set at least one AI provider key:
```bash
supabase secrets set OPENAI_API_KEY=sk-...
# OR
supabase secrets set GEMINI_API_KEY=...
```

### Signature verification failing

**Error**: `signature_mismatch` in authentication logs

**Solution**: Verify `WA_APP_SECRET` is correctly set:
```bash
# Get your app secret from Meta Developer Portal
# https://developers.facebook.com/apps/YOUR_APP_ID/whatsapp-business/wa-settings/
supabase secrets set WA_APP_SECRET=your-app-secret
```

### WhatsApp webhook verification failing

**Error**: GET requests returning 403

**Solution**: Set the verify token:
```bash
supabase secrets set WA_VERIFY_TOKEN=your-custom-token
# Use the same value in Meta webhook settings
```
