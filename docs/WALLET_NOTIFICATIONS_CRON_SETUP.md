# Wallet Notifications Cron Job Setup

## Overview
The `wallet-notifications` edge function processes queued wallet transaction notifications and sends WhatsApp messages to users. This function must be triggered regularly (ideally every minute) to ensure timely delivery of notifications.

## ⚠️ Important: GitHub Actions Limitation
**GitHub Actions can only run scheduled workflows every 5 minutes minimum**, not every minute. For production with high notification volume, use an external cron service.

## Setup Options

### Option 1: GitHub Actions (✅ Already Configured)
**File**: `.github/workflows/cron-wallet-notifications.yml`

**Schedule**: Every 5 minutes (*/5 * * * *)

**Setup**:
1. Add `SUPABASE_SERVICE_ROLE_KEY` to GitHub repository secrets
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: Your Supabase service role key

2. The workflow will run automatically every 5 minutes

3. Manual trigger:
   ```bash
   # Via GitHub UI: Actions → Process Wallet Notifications → Run workflow
   # Via GitHub CLI:
   gh workflow run cron-wallet-notifications.yml
   ```

**Pros**: 
- Free
- Already configured
- Easy to monitor
- Integrates with GitHub

**Cons**:
- 5-minute minimum interval (not 1 minute)
- Depends on GitHub Actions availability

---

### Option 2: Render.com Cron Job (Recommended for Production)
**Cost**: Free tier available
**Frequency**: Every 1 minute

**Setup**:
1. Go to https://dashboard.render.com
2. Sign up/login (can use GitHub account)
3. Click "New +" → "Cron Job"
4. Configure:
   - **Name**: `wallet-notifications-processor`
   - **Runtime**: Docker
   - **Docker Command**:
     ```bash
     curl -X POST 'https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wallet-notifications' \
       -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
       -H 'Content-Type: application/json' \
       -d '{}'
     ```
   - **Schedule**: `* * * * *` (every minute)

5. Click "Create Cron Job"

**Pros**:
- Runs every 1 minute
- Free tier available
- Reliable
- Auto-restarts on failure

**Cons**:
- Requires external service
- Need to manage credentials

---

### Option 3: cron-job.org (Easy External Service)
**Cost**: Free
**Frequency**: Every 1 minute (free tier)

**Setup**:
1. Go to https://cron-job.org
2. Sign up for free account
3. Click "Create cronjob"
4. Configure:
   - **Title**: Wallet Notifications Processor
   - **URL**: `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wallet-notifications`
   - **Request Method**: POST
   - **Custom Headers**:
     ```
     Authorization: Bearer YOUR_SERVICE_ROLE_KEY
     Content-Type: application/json
     ```
   - **Request Body**: `{}`
   - **Schedule**: Every minute (*/1)

5. Click "Create cronjob"

**Pros**:
- Very easy to set up
- Free
- Runs every 1 minute
- Email alerts on failures

**Cons**:
- Requires external service
- Free tier has limits (25 cron jobs)

---

### Option 4: EasyCron.com
**Cost**: Free tier (15 cron jobs)
**Frequency**: Every 1 minute

**Setup**:
1. Go to https://www.easycron.com
2. Sign up for free account
3. Click "Add Cron Job"
4. Configure:
   - **URL**: `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wallet-notifications`
   - **Cron Expression**: `* * * * *` (every minute)
   - **Request Type**: POST
   - **HTTP Headers**:
     ```
     Authorization: Bearer YOUR_SERVICE_ROLE_KEY
     Content-Type: application/json
     ```
   - **Post Data**: `{}`

5. Click "Create"

**Pros**:
- Runs every 1 minute
- Free tier available
- Good dashboard
- Logs and monitoring

**Cons**:
- Free tier limited to 15 jobs

---

### Option 5: Local Development (Testing Only)
For local testing, use the provided script:

```bash
# Set your service role key
export SUPABASE_SERVICE_ROLE_KEY='your_service_role_key_here'

# Run the local cron script
./scripts/cron-wallet-notifications.sh
```

Or use `watch`:
```bash
watch -n 60 'curl -X POST "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wallet-notifications" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{}"'
```

---

## Monitoring

### Check Pending Notifications
```sql
-- Count pending notifications
SELECT COUNT(*) as pending_count
FROM wallet_notification_queue
WHERE sent_at IS NULL;

-- View oldest pending notification
SELECT 
    MIN(created_at) as oldest_pending,
    NOW() - MIN(created_at) as age
FROM wallet_notification_queue
WHERE sent_at IS NULL;
```

### Check Recent Processing
```sql
-- Recently sent notifications
SELECT 
    COUNT(*) as sent_count,
    MAX(sent_at) as last_sent
FROM wallet_notification_queue
WHERE sent_at > NOW() - INTERVAL '1 hour';
```

### Manual Trigger
```bash
# Test the function manually
curl -X POST \
  https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wallet-notifications \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Troubleshooting

### No notifications being sent
1. Check if cron job is running:
   - GitHub Actions: Check workflow runs
   - External service: Check their dashboard

2. Check function logs:
   - Supabase Dashboard → Edge Functions → wallet-notifications → Logs

3. Check queue:
   ```sql
   SELECT * FROM wallet_notification_queue 
   WHERE sent_at IS NULL 
   ORDER BY created_at ASC 
   LIMIT 10;
   ```

### Notifications delayed
- **If using GitHub Actions**: Expected (5-minute delay)
  - Solution: Switch to external cron service
  
- **If using external service**: Check service status
  - Render.com: Check cron job logs
  - cron-job.org: Check execution history

### High volume of stuck notifications
1. Increase function timeout (default 30s)
2. Check WhatsApp API rate limits
3. Consider processing in batches (already does 50 per run)

---

## Recommended Setup

**For Production**: Use Render.com or cron-job.org (1-minute interval)

**For Development/Testing**: Use GitHub Actions (5-minute interval is fine)

**For Local Testing**: Use the provided bash script

---

## Security Notes

⚠️ **NEVER commit your service role key to Git**

- Use GitHub Secrets for GitHub Actions
- Use environment variables for external services
- Rotate keys regularly
- Monitor function invocation logs for suspicious activity

---

## Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [GitHub Actions Cron Syntax](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [Render.com Cron Jobs](https://render.com/docs/cronjobs)
- [cron-job.org Documentation](https://cron-job.org/en/documentation/)

---

**Date**: 2025-12-11  
**Status**: ✅ Configured with GitHub Actions (5-minute interval)  
**Recommendation**: Switch to external cron service for 1-minute interval
