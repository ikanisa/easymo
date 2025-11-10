# AI Agent Stack - Operational Runbooks

Quick reference guide for common operational tasks.

## Table of Contents

- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Deployment

### Deploy All Functions

```bash
supabase functions deploy ai-lookup-customer
supabase functions deploy ai-create-voucher
supabase functions deploy ai-redeem-voucher
supabase functions deploy ai-void-voucher
supabase functions deploy ai-whatsapp-webhook
supabase functions deploy ai-realtime-webhook
```

### Update Secrets

```bash
supabase secrets set OPENAI_API_KEY="sk-..."
supabase secrets set FEATURE_AGENT_CHAT="true"
supabase secrets set FEATURE_AGENT_VOICE="true"
```

### Enable/Disable Features

```bash
# Disable chat
supabase secrets set FEATURE_AGENT_CHAT="false"

# Enable voice
supabase secrets set FEATURE_AGENT_VOICE="true"
```

## Monitoring

### View Function Logs

```bash
# Live tail
supabase functions logs ai-whatsapp-webhook --tail

# Last 100 lines
supabase functions logs ai-create-voucher --limit 100

# Filter by correlation ID
supabase functions logs ai-lookup-customer | grep "correlation_id.*abc-123"
```

### Check Function Status

```bash
# List all functions
supabase functions list

# Test function directly
curl -X POST https://your-project.supabase.co/functions/v1/ai-lookup-customer \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"msisdn": "+250788000000"}'
```

### Monitor Key Metrics

Search logs for these events:
- `ai.tool.*.success` - Successful tool calls
- `ai.tool.*.error` - Tool call failures
- `ai.whatsapp.message.processing` - WhatsApp messages
- `ai.realtime.session.created` - Voice sessions

## Troubleshooting

### High Error Rate

1. Check function logs:
   ```bash
   supabase functions logs ai-create-voucher --limit 500 | grep error
   ```

2. Common causes:
   - OpenAI API down/rate limited
   - Database connection issues
   - Invalid tool arguments

3. Quick fix: temporarily disable the affected agent feature flag in Supabase secrets until a fix is deployed.

### Slow Response Times

1. Check OpenAI API status: https://status.openai.com

2. Review latency in logs:
   ```bash
   supabase functions logs ai-whatsapp-webhook | grep "ai.process"
   ```

3. Optimize if needed:
   - Reduce tool call complexity
   - Use faster model (e.g., gpt-3.5-turbo)
   - Implement caching

### WhatsApp Webhook Not Working

1. Verify webhook URL is set in WhatsApp dashboard
2. Check verify token matches:
   ```bash
   curl "https://your-project.supabase.co/functions/v1/ai-whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
   ```
3. Check function logs for incoming requests
4. Verify feature flag is enabled

### Tool Call Failures

1. Test tool directly:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/ai-create-voucher \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"customer_msisdn":"+250788000000","amount":10000}'
   ```

2. Check database permissions
3. Verify service role key has correct access
4. Review function logs for specific errors

## Maintenance

### Update AI Package

```bash
cd ai
# Make changes
pnpm build
pnpm test

# Commit and deploy
git add .
git commit -m "feat: update AI agent"
git push
```

### Update Supabase Functions

```bash
# Edit function code
cd supabase/functions/ai-create-voucher
# Make changes

# Redeploy
supabase functions deploy ai-create-voucher
```

### Rotate OpenAI API Key

```bash
# Get new key from OpenAI
# Update secret
supabase secrets set OPENAI_API_KEY="sk-new-key..."

# No restart needed - takes effect immediately
```

### Clear Message ID Cache

The WhatsApp webhook maintains an in-memory cache of processed message IDs (1-hour TTL). To clear:

```bash
# Redeploy function (clears memory)
supabase functions deploy ai-whatsapp-webhook
```

### Database Maintenance

```bash
# Check voucher statistics
psql $DATABASE_URL -c "
  SELECT status, COUNT(*) 
  FROM vouchers 
  WHERE issued_at > NOW() - INTERVAL '7 days'
  GROUP BY status;
"

# Check AI-generated vouchers
psql $DATABASE_URL -c "
  SELECT COUNT(*), DATE(issued_at) 
  FROM vouchers 
  WHERE policy_number LIKE 'AI-%'
  GROUP BY DATE(issued_at)
  ORDER BY DATE(issued_at) DESC 
  LIMIT 7;
"
```

## Cost Management

### Monitor OpenAI Usage

```bash
# Check token usage in logs
supabase functions logs ai-whatsapp-webhook | grep "usage"

# Review costs daily
# OpenAI Dashboard: https://platform.openai.com/usage
```

### Optimize Costs

1. **Use cheaper models**:
   ```bash
   supabase secrets set OPENAI_RESPONSES_MODEL="gpt-3.5-turbo"
   ```

2. **Reduce context**:
   - Limit conversation history
   - Minimize tool descriptions

3. **Implement caching**:
   - Cache customer lookups
   - Reuse session data

4. **Set rate limits**:
   - Per-user limits
   - Per-feature limits

## Incident Response

### Critical Issue (PII Leak, Major Outage)

1. **Immediate Action**:
   ```bash
   supabase secrets set FEATURE_AGENT_CHAT="false"
   supabase secrets set FEATURE_AGENT_VOICE="false"
   ```

2. **Notify Team**: Post in #incidents Slack channel

3. **Investigate**:
   - Review recent logs
   - Check recent code changes
   - Identify root cause

4. **Document**: Create incident report

### High Error Rate (>20%)

1. Check OpenAI API status
2. Review error logs
3. Consider partial rollback
4. Monitor for recovery

### Cost Spike (>200% expected)

1. Check usage patterns in OpenAI dashboard
2. Review recent conversations
3. Identify abuse or bugs
4. Implement rate limits if needed

## Common Commands

```bash
# Quick health check
curl https://your-project.supabase.co/functions/v1/ai-lookup-customer

# View all secrets
supabase secrets list

# Unset a secret
supabase secrets unset OPENAI_API_KEY

# Download function logs
supabase functions logs ai-whatsapp-webhook --limit 1000 > logs.txt

# Test WhatsApp webhook locally
ngrok http 54321
# Set webhook to ngrok URL in WhatsApp dashboard
```

## Support Contacts

- **On-call**: [rotation link]
- **Platform Team**: #platform-team
- **OpenAI Support**: api-support@openai.com
- **Supabase Support**: support@supabase.io
