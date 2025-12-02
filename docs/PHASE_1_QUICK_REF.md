# Phase 1 Quick Reference

## 🚀 Quick Deploy

```bash
# Deploy all services
./scripts/deploy-all.sh

# Deploy single service
./scripts/deploy-service.sh wa-webhook-core
```

## 🔍 Verify Health

```bash
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core/health | jq .
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-profile/health | jq .
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-mobility/health | jq .
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-insurance/health | jq .
```

## ⏪ Rollback

```bash
# Rollback to previous version
./scripts/rollback.sh wa-webhook-core

# Rollback to specific commit
./scripts/rollback.sh wa-webhook-core abc123f
```

## 📋 Pre-Deployment Checklist

- [ ] Supabase CLI installed: `npm install -g supabase`
- [ ] Deno installed: `brew install deno` or https://deno.land
- [ ] Logged in: `supabase login`
- [ ] Environment variables set in Supabase dashboard
- [ ] `WA_ALLOW_UNSIGNED_WEBHOOKS=false` in production

## 🔧 Scripts

| Script | Purpose |
|--------|---------|
| `scripts/phase1-cleanup.sh` | Remove backup files |
| `scripts/deploy-all.sh` | Deploy all 4 services |
| `scripts/deploy-service.sh` | Deploy single service |
| `scripts/rollback.sh` | Rollback deployment |

## 📁 Key Files

| File | Description |
|------|-------------|
| `supabase/functions/_shared/health-check.ts` | Health check module |
| `supabase/functions/_shared/env-validator.ts` | Environment validator |
| `docs/ENV_VARIABLES.md` | Environment variable docs |
| `docs/ROLLBACK_PROCEDURES.md` | Rollback procedures |
| `docs/DEPLOYMENT_CHECKLIST.md` | Full checklist |

## 🎯 Service Versions

| Service | Version |
|---------|---------|
| wa-webhook-core | 2.2.0 |
| wa-webhook-profile | 2.0.0 |
| wa-webhook-mobility | 1.1.0 |
| wa-webhook-insurance | 1.1.0 |

## ⚠️ Known Issues (Non-Blocking)

- Type errors in shared Supabase clients (fix in Phase 2)
- Deprecated function warnings (fix in Phase 2)
- Services are functional despite warnings

## 📞 Emergency Contacts

- On-Call: Check PagerDuty
- Supabase: support@supabase.io
- Slack: #incidents

## 🔗 Useful Links

- Health checks: `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/{service}/health`
- Supabase dashboard: https://supabase.com/dashboard
- Documentation: `docs/` directory
