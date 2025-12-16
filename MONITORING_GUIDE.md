# Log Monitoring Guide

## Overview

This guide explains how to monitor WhatsApp webhook logs to identify issues and ensure system health.

## Quick Monitoring

### Option 1: Using Script (Recommended)
```bash
./scripts/monitor_logs.sh
```

This script will:
- Monitor all wa-webhook functions
- Color-code log levels (ERROR=red, WARN=yellow, INFO=green)
- Show real-time log updates
- Continue until you press Ctrl+C

### Option 2: Using Supabase CLI
```bash
# Monitor all webhook functions
supabase functions logs --project-ref lhbowpbcpwoiparwnwgt \
    --filter "wa-webhook" \
    --follow

# Monitor specific function
supabase functions logs --project-ref lhbowpbcpwoiparwnwgt \
    --function wa-webhook-mobility \
    --follow
```

### Option 3: Using Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/logs
2. Filter by: `wa-webhook`
3. Watch for errors and warnings

## What to Monitor

### Critical Events (Must Investigate)

#### Errors (RED)
- `MOBILITY_ERROR`
- `BUY_SELL_ERROR`
- `PROFILE_WEBHOOK_ERROR`
- `WA_WEBHOOK_CORE_ERROR`
- Any error with status 500

**Action**: Investigate immediately, check error message and stack trace

#### Warnings (YELLOW)
- `MOBILITY_AUTH_BYPASS` (in production - investigate)
- `BUY_SELL_DIR_AUTH_BYPASS` (in production - investigate)
- `RATE_LIMITED`
- `DUPLICATE_BLOCKED` (expected, but monitor frequency)

**Action**: Review context, may need investigation

### Normal Events (Expected)

#### Info (GREEN)
- `SERVICE_STARTED`
- `MOBILITY_MESSAGE_RECEIVED`
- `BUY_SELL_MESSAGE_RECEIVED`
- `PROFILE_MENU_DISPLAYED`
- `WALLET_MENU_DISPLAYED`

**Action**: No action needed, these are normal operations

## Key Metrics to Watch

### Response Times
- Target: < 2 seconds
- Watch for: Slow responses (> 5 seconds)

### Error Rates
- Target: < 1% of requests
- Watch for: Spikes in error rates

### Request Volume
- Monitor: Number of requests per minute
- Watch for: Unusual spikes or drops

## Common Issues & Solutions

### Issue: High Error Rate
**Symptoms**: Many ERROR logs
**Check**:
1. Database connection issues
2. RPC function availability
3. Environment variables
4. External API issues

### Issue: Slow Responses
**Symptoms**: Requests taking > 5 seconds
**Check**:
1. Database query performance
2. External API latency
3. Function cold starts
4. Network issues

### Issue: Authentication Failures
**Symptoms**: `AUTH_FAILED` or `AUTH_BYPASS` warnings
**Check**:
1. WhatsApp signature configuration
2. Environment variables
3. Internal forward token

### Issue: Duplicate Messages
**Symptoms**: Many `DUPLICATE_BLOCKED` logs
**Check**:
1. WhatsApp retry behavior (normal)
2. Idempotency working correctly
3. Message ID uniqueness

## Monitoring During UAT

### Before Tests
1. Start log monitoring
2. Clear any existing errors
3. Verify system is healthy

### During Tests
1. Watch for errors in real-time
2. Note any warnings
3. Document unexpected behavior

### After Tests
1. Review all logs
2. Check error patterns
3. Document issues found

## Log Analysis

### Filter by Service
```bash
# Mobility only
supabase functions logs --filter "wa-webhook-mobility"

# Buy & Sell only
supabase functions logs --filter "wa-webhook-buy-sell"

# Profile only
supabase functions logs --filter "wa-webhook-profile"
```

### Filter by Level
```bash
# Errors only
supabase functions logs --filter "level:error"

# Warnings only
supabase functions logs --filter "level:warn"
```

### Filter by Event
```bash
# Specific event
supabase functions logs --filter "MOBILITY_ERROR"

# Multiple events
supabase functions logs --filter "MOBILITY_ERROR|BUY_SELL_ERROR"
```

## Alerting (Future)

Consider setting up alerts for:
- Error rate > 5%
- Response time > 5 seconds
- Service down
- Database connection failures

## Best Practices

1. **Monitor Continuously** during UAT and go-live
2. **Document Issues** as they occur
3. **Set Up Alerts** for production
4. **Review Logs Daily** for patterns
5. **Keep Logs** for at least 30 days

## Tools

- **Supabase Dashboard**: Visual log viewer
- **Supabase CLI**: Command-line monitoring
- **Custom Scripts**: Automated monitoring (see `scripts/`)

