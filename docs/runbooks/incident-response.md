# Incident Response Runbook

## Severity Levels

| Level    | Description       | Response Time | Examples          |
| -------- | ----------------- | ------------- | ----------------- |
| **SEV1** | Complete outage   | < 15 min      | All services down |
| **SEV2** | Major degradation | < 30 min      | One service down  |
| **SEV3** | Minor degradation | < 2 hours     | Increased latency |
| **SEV4** | Low impact        | < 24 hours    | Minor bugs        |

## SEV1: Complete Service Outage

### Symptoms

- Health checks returning 503 for all services
- No webhook events being processed
- Users not receiving responses

### Immediate Actions

1. **Confirm the outage**

   ```bash
   curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health
   ```

2. **Check Supabase status**
   - Visit: https://status.supabase.com/

3. **Check database connectivity**

   ```sql
   SELECT NOW();
   ```

4. **Review recent deployments**

   ```bash
   git log --oneline -10
   ```

5. **Rollback if necessary**
   ```bash
   ./scripts/rollback.sh wa-webhook-core <previous-commit>
   ```

### Communication

- Notify stakeholders via Slack: #easymo-incidents
- Update status page
- Prepare customer communication if outage > 30 min

## Common Issues & Solutions

### Issue: "Webhook signature verification failed"

**Cause:** App secret mismatch **Solution:**

1. Verify `WHATSAPP_APP_SECRET` in Supabase secrets
2. Compare with Meta dashboard app secret

### Issue: "Rate limit exceeded"

**Cause:** Too many requests from single user **Solution:**

1. Check for bot/spam activity
2. Review rate limit thresholds
3. Consider temporary IP blocking

### Issue: "Database connection refused"

**Cause:** Database pool exhausted **Solution:**

1. Check Supabase database status
2. Review connection pool settings
3. Look for connection leaks

## Post-Incident Actions

1. **Document the incident**
   - Create incident report in GitHub Issues
   - Include timeline, root cause, resolution

2. **Update runbooks**
   - Add new troubleshooting steps
   - Document new failure modes

3. **Implement preventive measures**
   - Add monitoring
   - Create automated alerts
   - Update tests

_Last Updated: 2025-12-02_
