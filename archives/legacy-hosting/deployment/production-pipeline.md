# easyMO Production Deployment Playbook

This document describes an idempotent, end-to-end deployment workflow that connects GitHub, Supabase, and Vercel for the easyMO admin application. Execute the sections in order and re-run the steps as needed—each step is safe to repeat because it either updates configuration in place or verifies previously completed work.

## Operator Inputs (collect before executing changes)
| Domain | Required details | Notes |
| --- | --- | --- |
| **GitHub** | Organization / account name, repository name & visibility, default branch, required PR checks, whether to create a new repo or reuse `easymo`, code owners & review rules | Branch protection and Actions permissions require org admin rights. |
| **Supabase** | Existing project reference ID or desired project name, region, preferred RLS baseline (on/off by default), need for Edge Functions, database migration / restore policy | Access to the Supabase dashboard is required to retrieve the anon/service keys. |
| **Vercel** | Team / scope, project name, production domain, preview domain policy, analytics preference | Ensure the GitHub app is installed for the chosen org/user. |
| **Application** | Framework confirmation (Next.js 13), package manager, build command overrides (if any), Node.js runtime | `admin-app` contains the Next.js source; confirm `npm` or `pnpm`. |
| **Compliance & Ops** | OSS license (e.g., MIT), security policy URL, incident contacts (on-call emails / Slack), rollback contacts | Capture escalation paths before go-live. |

Document any missing inputs in the "Open items" section before proceeding. Track collection status in [`operator-inputs-template.md`](./operator-inputs-template.md) so the information can be surfaced during review using the merge-readiness checklist.

## A. Discovery Summary
- **Repo layout**: Single repository with two top-level folders: `admin-app` (Next.js 13 app router client) and `supabase` (CLI project scaffold). No other packages detected → treat as *polyrepo-style single app*.
- **App root**: `admin-app`; set as the working directory for package scripts and Vercel builds.
- **Framework defaults**: Next.js 13+, Node.js 18 runtime, build command `npm run build`, dev server `npm run dev`, output `.next`. Static assets served from Vercel Edge by default.
- **Data layer**: Supabase (PostgreSQL + Auth). CLI metadata lives in `supabase` folder; migrations belong in `supabase/migrations`.
- **Assumptions requiring confirmation**:
  1. Package manager is `npm` (update if `pnpm` or `yarn` is standard).
  2. Supabase Edge Functions are not yet used (create scaffolding only if requested).
  3. Environment variable names follow Supabase defaults (see matrix below).
  4. No custom Next.js server runtime beyond default Node 18.

Update this section after validating each assumption.

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
   - Require status checks: `ci` workflow (lint/test/build) and Vercel preview check (see section F).
   - Restrict who can push (allow only admins/bots). Disallow force pushes and deletions.
4. **Pull request hygiene**
   - `.github/pull_request_template.md` now codifies testing + deployment sign-off and conventional commits.
   - Share branch naming convention (`type/scope-description`).
5. **CI secrets registry** (names only; values stored in repo settings → Secrets and variables → Actions):
   - `VERCEL_TOKEN` – Vercel personal/token with deployments scope for GitHub Actions (if manual deploys required).
   - `SUPABASE_ACCESS_TOKEN` – For Supabase CLI automation.
   - `SUPABASE_DB_PASSWORD` – Optional for running migrations locally in CI.
   - `NEXT_PUBLIC_APP_URL` – Stored as Actions variable (non-secret) for e2e tests.
   - `SUPABASE_SERVICE_ROLE_KEY` – Only if server-side scripts are executed in CI (protect via environments).
   - Document in repo settings description that secrets must also be added to Vercel/Supabase dashboards.

Record the GitHub repository URL for inclusion in the final report. Use the [merge readiness checklist](./merge-readiness-checklist.md) to confirm branch protections and CI signals before requesting review.

## C. Environment Variable Matrix
Environment variables are tracked in `.env.example` (no secrets). Populate real values only inside Vercel and Supabase. The matrix below defines scope and consumers.

| Name | Description | Consumer(s) | Scope | Source of truth |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | HTTPS endpoint for Supabase project | Next.js (client + server) | Preview + Production | Vercel Project Environment (Preview & Production) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for browser access | Next.js client | Preview + Production | Vercel Project Environment |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-only operations | Next.js server components / API routes, Supabase CLI | Production only by default; add Preview if edge functions require | Vercel Environment (encrypted secret) + GitHub Actions secret (if migrations run in CI) |
| `SUPABASE_JWT_SECRET` | JWT signing secret used by Supabase Auth | Supabase API + Next.js server for token validation | Production (match Supabase project); replicate to Preview if staging auth needs validation | Supabase Settings → API (primary) |
| `NEXT_PUBLIC_APP_URL` | Canonical URL used for redirects and meta tags | Next.js client/server | Environment-specific | Vercel → Preview uses auto-generated URL; Production uses custom domain |

**Vercel mapping**
- Preview Environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional staging variants of server-side secrets.
- Production Environment: all variables above with production values.
- Development (local): developers copy `.env.example` to `.env.local` and fill with Supabase staging credentials.

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

## E. Vercel Project Configuration
1. **Project linking**
   - Use `vercel link` locally or connect via the Vercel dashboard. Target the specified team scope and select the GitHub repository.
   - For monorepo detection, set **Root Directory** to `admin-app`.
2. **Build settings**
   - Framework preset: **Next.js**.
   - Install command: `npm install` (override if another package manager is confirmed).
   - Build command: `npm run build`.
   - Output directory: `.next` (handled automatically by preset).
   - Node.js version: 18.x.
3. **Environment variables**
   - Add variables from the matrix using the Vercel dashboard or `vercel env pull`. No secret values should appear in version control.
   - Use Preview values that point to Supabase staging resources if available.
4. **Domains & analytics**
   - Production domain: add custom domain (e.g., `admin.easymo.example`). Verify DNS or request operator to configure.
   - Preview URLs: use Vercel-generated `*.vercel.app` links; share in PR template.
   - Analytics: opt-in to Vercel Web Analytics if desired; otherwise disable (document operator decision).
5. **Zero-secret exposure**
   - Confirm Next.js does not expose server-only secrets by ensuring only `NEXT_PUBLIC_*` variables are referenced in client bundles. Use `npm run build` output to verify warnings.

Record the Vercel project URL plus latest Preview & Production deployment URLs. Include deployment IDs in the [final report template](./final-report-template.md).

## F. CI / CD Policy
1. **GitHub Actions**
   - Create `.github/workflows/ci.yml` (follow-up task) running: `npm ci`, `npm run lint`, `npm run test`, `npm run build` within `admin-app`.
   - Gate migrations: optional job running Supabase CLI commands using the secrets listed above.
   - Cache Node modules with Actions cache to keep runs idempotent.
2. **Deployment flow**
   - Vercel GitHub integration automatically builds Preview deployments for every PR. Require the `Vercel (Preview)` check to pass before merge.
   - Merge into default branch triggers Production deployment. Require the `Vercel (Production)` check after merge (monitored via branch protections).
   - Document manual promotion path (Vercel supports promoting a Preview to Production if needed).
3. **Status checks in branch protections**
   - `ci` (GitHub Actions pipeline).
   - `Vercel (Preview)`.
   - Optional: `Supabase Migration Dry Run` if implemented.

## G. Verification Checklist
After each deployment, capture evidence (screenshots/notes) that:
- Production URL (`https://admin.easymo.example` placeholder) responds 200 and renders dashboard shell.
- Static assets load without console errors (check `/.next/static/*`).
- Supabase anon client initializes successfully (look for `supabase.auth.getSession()` returning status 200).
- Critical API routes (e.g., `/api/v1/users`) return expected schema.
- Preview deployment replicates above using staging credentials.
- Record Vercel deployment IDs (Preview & Production) for auditing and file the evidence in `docs/deployment/status/` alongside the final report.

## H. Rollback Playbook
1. **Vercel**
   - Use the Vercel dashboard → Deployments → Production → "Promote Previous" to instantly roll back to a known-good deployment.
   - Alternatively, redeploy a specific commit with `vercel deploy --prod --archive <deployment-id>`.
2. **GitHub**
   - Revert the offending commit/PR on the default branch (`git revert <sha>`), push, and allow CI + Vercel to redeploy.
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
- Vercel project URL, latest Preview URL, Production URL.
- Supabase dashboard link & project ref.
- Environment variable matrix snapshot (names + scopes only).
- Verification evidence (links to PR, deployment checks, Supabase smoke test logs).
- Runbooks:
  - **Add environment variable**: update `.env.example`, add to Vercel Preview/Production, add to Supabase secrets if relevant, document in PR.
  - **Redeploy**: trigger Vercel rebuild via commit or `vercel deploy`, confirm GitHub Actions success, update report.
  - **Rollback**: follow section H, record incident timeline, notify contacts.
- Open items awaiting operator input (e.g., missing secrets, DNS setup, analytics opt-in, incident contacts, license selection).
- Confirmed assumptions vs outstanding questions.

Keeping this report updated ensures the deployment remains auditable and repeatable.
