# Deployment Scripts

Consolidated deployment infrastructure for EasyMO platform.

## Quick Start

```bash
# Deploy everything to staging
./scripts/deploy/all.sh --env staging

# Deploy to production (with confirmation)
./scripts/deploy/all.sh --env production

# Dry run (see what would happen)
./scripts/deploy/all.sh --env production --dry-run

# Skip migrations (already applied)
./scripts/deploy/all.sh --env staging --skip-migrations
```

## Script Overview

| Script | Purpose | Dependencies |
|--------|---------|--------------|
| `all.sh` | Deploy entire platform | All other scripts |
| `edge-functions.sh` | Deploy Supabase Edge Functions | Supabase CLI |
| `migrations.sh` | Run database migrations | Supabase CLI |
| `services.sh` | Deploy Node.js microservices | Docker, GCP CLI |
| `frontend.sh` | Deploy frontend apps | Netlify CLI |

## Environment Files

Create environment-specific files in project root:

- `.env.staging` - Staging environment
- `.env.production` - Production environment

Required variables:
```bash
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_ACCESS_TOKEN=your-access-token
GCP_PROJECT_ID=your-gcp-project
NETLIFY_AUTH_TOKEN=your-netlify-token
```

## Deployment Order

1. **Build shared packages** - `@va/shared`, `@easymo/commons`
2. **Run migrations** - Database schema updates
3. **Deploy edge functions** - Supabase serverless functions
4. **Deploy services** - NestJS microservices to Cloud Run
5. **Verify** - Health checks and smoke tests

## Safety Features

- ✅ Dry-run mode (`--dry-run`)
- ✅ Environment validation (required vars check)
- ✅ Build order automation
- ✅ Post-deployment verification
- ✅ Rollback procedures (see `../maintenance/rollback.sh`)

## Troubleshooting

**Build fails:**
```bash
# Clean and rebuild
pnpm clean
pnpm install --frozen-lockfile
./scripts/deploy/all.sh --env staging
```

**Migration fails:**
```bash
# Check migration status
supabase db reset --linked
supabase db push --linked
```

**Service deployment fails:**
```bash
# Check service logs
gcloud run services describe wallet-service --region us-central1
```
