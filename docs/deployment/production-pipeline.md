# easyMO Local Hosting Deployment Guide

This document describes the deployment workflow for the easyMO admin application when hosting locally. The application connects to GitHub and Supabase for source control and backend services. Execute the sections in order and re-run the steps as needed—each step is safe to repeat because it either updates configuration in place or verifies previously completed work.

**Note:** This application is designed for local hosting. Previous Vercel deployment references have been removed.

## Operator Inputs (collect before executing changes)
| Domain | Required details | Notes |
| --- | --- | --- |
| **GitHub** | Organization / account name, repository name & visibility, default branch, required PR checks, whether to create a new repo or reuse `easymo`, code owners & review rules | Branch protection and Actions permissions require org admin rights. |
| **Supabase** | Existing project reference ID or desired project name, region, preferred RLS baseline (on/off by default), need for Edge Functions, database migration / restore policy | Access to the Supabase dashboard is required to retrieve the anon/service keys. |
| **Local Hosting** | Server specifications, domain/port configuration, SSL certificate setup, reverse proxy configuration (nginx, caddy, etc.) | Ensure adequate resources for running Next.js and related services. |
| **Application** | Framework confirmation (Next.js 14), package manager (pnpm recommended), build command overrides (if any), Node.js runtime (18+) | `admin-app` contains the Next.js source. |
| **Compliance & Ops** | OSS license (e.g., MIT), security policy URL, incident contacts (on-call emails / Slack), rollback contacts | Capture escalation paths before go-live. |

Document any missing inputs in the "Open items" section before proceeding. Track collection status in [`operator-inputs-template.md`](./operator-inputs-template.md) so the information can be surfaced during review using the merge-readiness checklist.

## A. Discovery Summary
- **Repo layout**: Single repository with two top-level folders: `admin-app` (Next.js 14 app router client) and `supabase` (CLI project scaffold). No other packages detected → treat as *polyrepo-style single app*.
- **App root**: `admin-app`; set as the working directory for package scripts and local builds.
- **Framework defaults**: Next.js 14+, Node.js 18 runtime, build command `pnpm run build`, dev server `pnpm run dev`, output `.next`. Static assets served locally.
- **Data layer**: Supabase (PostgreSQL + Auth). CLI metadata lives in `supabase` folder; migrations belong in `supabase/migrations`.
- **Assumptions requiring confirmation**:
  1. Package manager is `pnpm` (recommended; can also use `npm`).
  2. Supabase Edge Functions are deployed separately using Supabase CLI.
  3. Environment variable names follow Supabase defaults (see matrix below).
  4. No custom Next.js server runtime beyond default Node 18+.

Update this section after validating each assumption.

### 2025-02-17 Repository inventory update

- The repository now hosts two active front-end roots: the Mobility Admin SPA
  at the repo root (`./`) and the Next.js admin control panel under
  `admin-app/`. Both consume shared typed route helpers from `@va/shared`.
- Historical scaffolds such as `angular/` and the pending `station-app/`
  remain out of scope for production until their roadmaps resume. Typed
  routing is deferred there because no concrete routes exist yet (see
  `docs/deployment/root-application-inventory.md`).
- Backend services live under `apps/` and `services/`; they are deployed locally alongside the admin app and are tracked separately in service-specific runbooks.

## B. GitHub Repository Setup
1. **Repository creation/linking**
   - If a new repo is needed: create under the supplied org, import this codebase, and set the default branch (e.g., `main`).
   - If reusing `easymo`: ensure local repo is pointed at the GitHub remote and branch history matches.
2. **Metadata**
   - Add/confirm `README.md` with project overview, `LICENSE`, and ensure `.gitignore` (already present) matches Next.js defaults.
   - Enable GitHub Issues and Actions in repository settings.
3. **Branch protections** (apply to default branch; idempotent via GitHub UI or `gh api`):
   - Require pull request before merge with ≥1 approving review (increase count per operator input).
   - Dismiss stale approvals on new commits.
   - Require status checks: `ci` workflow (lint/test/build).
   - Restrict who can push (allow only admins/bots). Disallow force pushes and deletions.
4. **Pull request hygiene**
   - `.github/pull_request_template.md` now codifies testing + deployment sign-off and conventional commits.
   - Share branch naming convention (`type/scope-description`).
5. **CI secrets registry** (names only; values stored in repo settings → Secrets and variables → Actions):
   - `SUPABASE_ACCESS_TOKEN` – For Supabase CLI automation.
   - `SUPABASE_DB_PASSWORD` – Optional for running migrations locally in CI.
   - `NEXT_PUBLIC_APP_URL` – Stored as Actions variable (non-secret) for e2e tests.
   - `SUPABASE_SERVICE_ROLE_KEY` – Only if server-side scripts are executed in CI (protect via environments).
   - Document in repo settings description that secrets must also be added to Supabase dashboard and local .env files.

Record the GitHub repository URL for inclusion in the final report. Use the [merge readiness checklist](./merge-readiness-checklist.md) to confirm branch protections and CI signals before requesting review.

## C. Environment Variable Matrix
Environment variables are tracked in `.env.example` (no secrets). Populate real values in local `.env` files and Supabase dashboard. The matrix below defines scope and consumers.

| Name | Description | Consumer(s) | Scope | Source of truth |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | HTTPS endpoint for Supabase project | Next.js (client + server) | Development + Production | Local `.env` files |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for browser access | Next.js client | Development + Production | Local `.env` files |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-only operations | Next.js server components / API routes, Supabase CLI | Production only by default; use separate key for development | Local `.env` files (encrypted) + GitHub Actions secret (if migrations run in CI) |
| `SUPABASE_JWT_SECRET` | JWT signing secret used by Supabase Auth | Supabase API + Next.js server for token validation | Production (match Supabase project); replicate to development for local auth | Supabase Settings → API (primary) |
| `NEXT_PUBLIC_APP_URL` | Canonical URL used for redirects and meta tags | Next.js client/server | Environment-specific | Local `.env` files with appropriate domain/port |

**Local environment setup:**
- Development: Copy `.env.example` to `.env.local` and populate with development Supabase credentials and `http://localhost:PORT` for `NEXT_PUBLIC_APP_URL`.
- Production: Set production values in `.env` on the hosting server with production domain for `NEXT_PUBLIC_APP_URL`.

**Supabase config**
- Store `SUPABASE_JWT_SECRET` and service role rotation plan inside Supabase Dashboard.
- If Edge Functions require secrets, place them in `supabase/functions/<function>/.env.example` (versioned) and configure using Supabase secrets CLI.

## D. Supabase Integration
1. **Project link**
   - Run `supabase link --project-ref <ref>` inside the `supabase` folder once the project ref is available. This updates `.supabase/config.toml`; re-running the command is idempotent.
2. **Migrations workflow**
   - Use `supabase migration new <name>` to create SQL migrations under `supabase/migrations`.
   - Commit migrations and require review via PR template checklist.
   - In CI, run `supabase db push --dry-run` against a temporary database (requires `SUPABASE_ACCESS_TOKEN`).
   - Before production deploys, run migrations against staging → verify → promote to production using Supabase dashboard or `supabase db push` with `--env prod`.
3. **Edge Functions (optional)**
   - Directory: `supabase/functions/<function-name>/`.
   - Deploy order: Preview (via `supabase functions deploy <name> --project-ref <preview ref>`) → Production after validation.
   - Environment names follow pattern `<FUNCTION_NAME>_SERVICE_ROLE_KEY` etc.; document per function.
4. **Row Level Security (RLS)**
   - Enable RLS globally, then define policies per table using migrations.
   - Document default policies (e.g., admin users only). Include them in migrations for idempotency.
5. **Post-deploy smoke test**
   - Script a Next.js API route or CLI task that: (a) fetches `/rest/v1/<table>` with anon key, (b) performs insert/update via service role (if allowed), (c) validates response codes.

Record Supabase dashboard URL and project ref for the final report and capture them in the [final report template](./final-report-template.md).

## E. Local Hosting Setup
1. **Build configuration**
   - Navigate to `admin-app` directory.
   - Install dependencies: `pnpm install` (or `npm install`).
   - Build command: `pnpm run build` (or `npm run build`).
   - Output directory: `.next` (handled automatically by Next.js).
   - Node.js version: 18.x or higher required.
2. **Environment variables**
   - Copy `.env.example` to `.env.local` in the `admin-app` directory.
   - Populate all required values from the matrix above using local secrets management.
   - Ensure no secret values appear in version control (`.env.local` should be in `.gitignore`).
3. **Production hosting options**
   - **Option A - PM2**: Use PM2 process manager (`pm2 start npm --name "admin-app" -- start`)
   - **Option B - Systemd**: Create a systemd service to manage the Next.js process
   - **Option C - Docker**: Use the provided Dockerfile (if available) or create one for containerized deployment
   - Configure a reverse proxy (nginx, caddy) to handle SSL/TLS and route traffic to the Next.js server
4. **Domains & SSL**
   - Production domain: configure DNS to point to your hosting server (e.g., `admin.easymo.example`).
   - SSL certificate: use Let's Encrypt with certbot or load certificates in your reverse proxy.
   - Port configuration: Next.js typically runs on port 3000; configure reverse proxy accordingly.
5. **Zero-secret exposure**
   - Confirm Next.js does not expose server-only secrets by ensuring only `NEXT_PUBLIC_*` variables are referenced in client bundles. Use `pnpm run build` output to verify warnings.

Document the hosting setup and production URL in the [final report template](./final-report-template.md).

## F. CI / CD Policy
1. **GitHub Actions**
   - Create `.github/workflows/ci.yml` running: `pnpm ci`, `pnpm run lint`, `pnpm run test`, `pnpm run build` within `admin-app`.
   - Gate migrations: optional job running Supabase CLI commands using the secrets listed above.
   - Cache Node modules with Actions cache to keep runs idempotent.
2. **Deployment flow**
   - Local hosting: Deploy by pulling latest code from the default branch, running build, and restarting the application process.
   - Consider using GitHub Actions to automate deployment via SSH or deployment tools.
   - Manual deployment: SSH to server, `git pull`, `pnpm install`, `pnpm run build`, restart service.
3. **Status checks in branch protections**
   - `ci` (GitHub Actions pipeline for lint/test/build).
   - Optional: `Supabase Migration Dry Run` if implemented.

## G. Verification Checklist
After each deployment, capture evidence (screenshots/notes) that:
- Production URL (`https://admin.easymo.example` placeholder) responds 200 and renders dashboard shell.
- Static assets load without console errors (check `/.next/static/*`).
- Supabase anon client initializes successfully (look for `supabase.auth.getSession()` returning status 200).
- Critical API routes (e.g., `/api/v1/users`) return expected schema.
- Document deployment date, git commit hash, and hosting server details in `docs/deployment/status/` alongside the final report.

## H. Rollback Playbook
1. **Local hosting**
   - Keep previous build artifacts or use git to revert to a known-good commit.
   - Deploy the previous version: `git checkout <previous-commit>`, `pnpm install`, `pnpm run build`, restart service.
   - Consider using deployment tagging or release branches for easier rollback.
2. **GitHub**
   - Revert the offending commit/PR on the default branch (`git revert <sha>`), push, and redeploy following your deployment process.
   - Document revert in incident notes.
3. **Supabase**
   - Maintain down migrations for every change (`supabase migration new --down`).
   - To restore data, follow Supabase PITR or backup restore policy defined in operator inputs.
   - Notify database owners before executing destructive rollbacks.
4. **Incident contacts**
   - Populate security/ops contact list (emails/Slack handles) once provided.

## I. Final Report Template
After executing the steps above, copy [`final-report-template.md`](./final-report-template.md) into `docs/deployment/status/<date>.md` and populate it with the following evidence:
- GitHub repository URL & default branch.
- Production hosting details (server, domain, SSL configuration).
- Supabase dashboard link & project ref.
- Environment variable matrix snapshot (names + scopes only).
- Verification evidence (links to PR, deployment checks, Supabase smoke test logs).
- Runbooks:
  - **Add environment variable**: update `.env.example`, add to local `.env` files, add to Supabase secrets if relevant, document in PR.
  - **Redeploy**: pull latest code, rebuild, restart service, confirm application health.
  - **Rollback**: follow section H, record incident timeline, notify contacts.
- Open items awaiting operator input (e.g., missing secrets, DNS setup, incident contacts, license selection).
- Confirmed assumptions vs outstanding questions.

Keeping this report updated ensures the deployment remains auditable and repeatable.
