# Deployment Runbook

## Pre-Deployment Checklist

- [ ] All tests passing in CI/CD
- [ ] Code review approved
- [ ] No critical open issues
- [ ] Database migrations reviewed (if any)
- [ ] Environment variables verified
- [ ] Rollback plan prepared

## Standard Deployment

### Step 1: Prepare

```bash
git checkout main
git pull origin main
git log --oneline -1
```

### Step 2: Run Pre-Deployment Checks

```bash
deno check supabase/functions/wa-webhook-core/index.ts
deno check supabase/functions/wa-webhook-profile/index.ts
deno check supabase/functions/wa-webhook-mobility/index.ts
```

### Step 3: Deploy Services

```bash
# 1. Core service first (handles routing)
supabase functions deploy wa-webhook-core --no-verify-jwt

# 2. Profile service
supabase functions deploy wa-webhook-profile --no-verify-jwt

# 3. Mobility service
supabase functions deploy wa-webhook-mobility --no-verify-jwt
```

### Step 4: Verify Deployment

```bash
./scripts/verify-deployment.sh
```

### Step 5: Smoke Test

1. Send "hi" to the WhatsApp bot
2. Verify home menu appears
3. Test each major flow

## Rollback Procedure

### Quick Rollback

```bash
./scripts/rollback.sh wa-webhook-<service>
# Or rollback to specific commit
./scripts/rollback.sh wa-webhook-<service> <commit-sha>
```

### Full Rollback

```bash
git checkout <commit-sha>
./scripts/deploy-all.sh
```

## Post-Deployment

1. **Monitor for 30 minutes**
   - Watch error rates
   - Check response times
   - Review logs

2. **Update documentation**
   - Update CHANGELOG.md
   - Update version numbers

3. **Notify team**
   - Post in #deployments channel
   - Include version and changes

_Last Updated: 2025-12-02_
