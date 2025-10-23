# Production Deployment Pipeline (GitHub → Supabase → Self-Hosted)

This document describes an idempotent deployment workflow that connects GitHub, Supabase, and the self-hosted runtime for the EasyMO admin application. Execute the sections in order; each step is safe to repeat because it either updates configuration in place or verifies previously completed work.

## A. Source Control Hygiene

- Default branch: `main`.
- Require PR reviews with status checks (`ci` workflow running lint/test/build).
- Protect `main` with `Require status checks` and `Require signed commits` (optional but recommended).
- Use `chore/*`, `feat/*`, `fix/*` prefixes for topic branches.

## B. Secrets Matrix

Track secrets in three locations:

| Location | What lives there | Notes |
| --- | --- | --- |
| **GitHub Actions** | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`, `REGISTRY_TOKEN`, `REGISTRY_USER`, `ADMIN_API_TOKEN` | Used for migrations, smoke tests, and container publishing. |
| **Supabase** | `EASYMO_ADMIN_TOKEN`, `SERVICE_ROLE_KEY`, `DISPATCHER_FUNCTION_URL`, WhatsApp/OCR tokens | Managed via `supabase secrets set`. |
| **Hosting stack** | `.env`, docker-compose overrides, Kubernetes secrets, nginx env files | Mirror GitHub/Supabase values so runtime stays aligned. |

Environment variables are documented in `.env.example`. Populate real values only inside GitHub/Supabase/hosting secrets. The matrix below defines scope and consumers.

| Variable | Purpose | Consumers |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | HTTPS endpoint for Supabase project | SPA + admin app |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for browser access | SPA |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server operations | Admin app, Supabase Edge Functions |
| `NEXT_PUBLIC_APP_URL` | Canonical URL used for redirects and meta tags | SPA/admin app |
| `VITE_ADMIN_TOKEN` / `ADMIN_TOKEN` / `EASYMO_ADMIN_TOKEN` | Shared admin secret for Supabase functions | SPA/admin app/Edge Functions |
| `ADMIN_SESSION_SECRET`, `ADMIN_ACCESS_CREDENTIALS` | Cookie/session + operator access | Admin app |
| `DISPATCHER_FUNCTION_URL` | Campaign dispatch endpoint | SPA + cron workers |

## C. Build Artifacts

- SPA (`app/`): `pnpm run build` → `dist/`
- Admin app (`admin-app/`): `pnpm --filter admin-app build` → `.next/`
- Supabase migrations: `supabase/migrations/*`
- Supabase Edge Functions: `supabase/functions/*`

Publish Docker images via GitHub Actions:

1. `docker build -f app/Dockerfile -t ghcr.io/<org>/easymo-spa:<sha> app`
2. `docker build -f admin-app/Dockerfile -t ghcr.io/<org>/easymo-admin:<sha> admin-app`
3. Push both images using the `REGISTRY_USER`/`REGISTRY_TOKEN` secrets.

## D. Continuous Integration

`.github/workflows/ci.yml` should run:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`
5. `pnpm --filter admin-app build`
6. `supabase db lint` (optional) or schema validation scripts
7. Publish Docker images on successful builds (only for `main`)

Require the workflow check before merge. Attach artifacts (build logs, container digests) to the run for traceability.

## E. Hosting Configuration

- Reverse proxy: nginx (see `infrastructure/nginx/easymo.conf`).
- Containers: use `docker-compose.prod.yml` or Kubernetes manifests under `infrastructure/k8s/`.
- Mount configuration via environment variables referenced in Section B.
- Enable HTTPS with Let’s Encrypt/Certbot or the platform’s certificate manager.
- Configure log shipping (Fluent Bit → Loki/Elasticsearch) and metrics exporters (Prometheus node exporter + Supabase telemetry).

## F. Deployment Steps

1. Merge PR into `main` once CI passes.
2. GitHub Actions builds/pushes new SPA and admin images.
3. The pipeline runs `supabase db push --project-ref <ref>` and `supabase functions deploy` using service tokens.
4. On the host:
   - Pull new container images (`docker compose pull && docker compose up -d`).
   - Run database migrations if not handled in CI (`pnpm run db:migrate` or `supabase db push`).
   - Reload nginx.
5. Execute smoke tests:
   - `scripts/smoke-brokerai.sh http://<host>`
   - `pnpm exec node scripts/health-check.mjs`
6. Update `docs/go-live-readiness.md` with deployment details (image digest, timestamp, operator).

## G. Rollback

1. Pull the previous container tags (`docker compose pull <service>@<old-tag>`).
2. Re-run `docker compose up -d`.
3. If migrations introduced regressions, run `supabase db remote commit --rollback <sha>` or apply the rollback script under `supabase/migrations`.
4. Update runbook with rollback reason and remediation steps.

## H. Audit Trail

- Record container digests, Supabase migration hashes, and deployment timestamps in `docs/deployment/status/`.
- Store CI build logs for 30 days.
- Ensure access logs (nginx + Supabase) are retained per compliance requirements.

## I. Change Management Checklist

- [ ] Branch merged with required reviews
- [ ] CI build artifacts stored
- [ ] Supabase migrations applied
- [ ] Supabase Edge Functions deployed
- [ ] Containers redeployed
- [ ] Smoke tests passed
- [ ] Documentation updated
- [ ] Rollback plan validated
