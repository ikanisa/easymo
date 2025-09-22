# easyMO deployment report

_Last updated: <!-- YYYY-MM-DD -->_

## A. Discovery summary

- **App root:** `admin-app` (Next.js App Router structure). No package manifest committed yet; expect a
  `package.json` in the same directory when the app is imported.
- **Monorepo status:** Lightweight monorepo with distinct `admin-app/` and `supabase/` directories. CI auto-
  detects the first available package manifest.
- **Build assumptions:** Next.js 14+, `pnpm` as package manager, Node.js 20 runtime, build output in `.next/`.
- **Open confirmation items:**
  - Confirm final package manager and framework version.
  - Provide actual package manifest to enable CI scripts.
  - Validate whether additional workspaces (e.g., landing site) will join the repo.

## B. GitHub configuration

- **Repository URL:** _fill after creation_
- **Default branch:** `main` (change if different in Section A).
- **Protections to enable:**
  - Require 1+ approving review, dismiss stale reviews, block force pushes.
  - Require status check: `CI (build-test)`.
  - Require branches to be up to date before merging.
- **CI signals:** `.github/workflows/ci.yml` (see Section F).
- **Secrets to register (names only):**
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_DB_PASSWORD`
  - `SUPABASE_JWT_SECRET`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_APP_URL`
  - `INCIDENT_CONTACT`
  - Additional provider secrets (add below as discovered): _pending_
- **Documentation assets committed:** README, PR template, bootstrap instructions (this repo).

## C. Environment variable matrix

| Variable | Description | Consumer(s) | Source platform | Scope |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Base URL for Supabase API | Next.js client/server | Vercel env, Supabase settings | Preview + Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for Supabase auth | Next.js client | Vercel env, Supabase API | Preview + Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key for elevated access | GitHub Actions (if needed), Edge Functions | GitHub secrets, Vercel Production | Production only |
| `SUPABASE_JWT_SECRET` | JWT verifier for auth hooks | Edge Functions, Supabase auth settings | Supabase config, Vercel Production | Production only |
| `SUPABASE_DB_PASSWORD` | Direct Postgres password for CLI migrations | Local developers, GitHub secrets | Supabase config, GitHub secrets | Preview (CLI) + Production |
| `NEXT_PUBLIC_APP_URL` | Absolute origin for the deployed app | Next.js client/server | Vercel env | Preview (staging URL) + Production (custom domain) |
| `INCIDENT_CONTACT` | Notification channel/email | GitHub Actions, Ops tooling | GitHub secrets, Vercel env | Production only |

> Keep `.env.example` aligned with this table. Never commit `.env` files with values.

## D. Supabase link & database workflow

- **Dashboard URL:** https://supabase.com/dashboard/project/`<project_ref>`
- **Project ref:** _pending operator input_
- **Linking command:** `supabase link --project-ref <project_ref>` from repository root.
- **Migrations:**
  - Store migration SQL in `supabase/migrations/<timestamp>_<name>.sql`.
  - Require PR review for every migration file; include verification notes in the PR body.
  - Deployment checklist:
    1. `pnpm test` (if backend tests exist).
    2. `supabase db lint` (optional) and `supabase db diff` to preview changes.
    3. `supabase db push` after merge (Production only).
- **Edge Functions:**
  - Place functions under `supabase/functions/<function-name>/index.ts` (or `main.ts`).
  - Use per-function env names prefixed with `SUPABASE_FN_<FUNCTION>_` (e.g., `SUPABASE_FN_SEND_INVITE_SECRET`).
  - Rollout order: deploy to Preview environment (via branch) → smoke test → promote to Production.
- **RLS expectations:** Enforce RLS on all tables; document any exceptions in this section.
- **Post-deploy smoke test:** Run `supabase gen types typescript --linked` and execute a read/write test using the
  anon key to confirm policies.

## E. Vercel configuration

- **Project URL:** https://vercel.com/<team>/<project>
- **Framework preset:** Next.js (app directory).
- **Root directory:** `admin-app`.
- **Build command:** `pnpm install --frozen-lockfile && pnpm build`.
- **Output directory:** `.next` (Vercel default for Next.js).
- **Node runtime:** `nodejs20.x`.
- **Env variable mapping:** Use `vercel project env pull`/`push` to sync names in Section C.
- **Domains:**
  - Production: `admin.easymo.com` (custom) + default `*.vercel.app` fallback.
  - Preview: auto-generated `*-git-<branch>-<project>.vercel.app` URLs.
- **Analytics:** _decide (default off)_. Document decision here once made.

## F. CI / CD policy

- GitHub Actions workflow `CI (build-test)` must pass before merging to the default branch.
- Vercel Git integration deploys every PR branch to a Preview environment. Require the Vercel deployment check in
  branch protection.
- Merges to `main` trigger Production deploy automatically via Vercel.
- Optional GitHub Action jobs to add later (reference secrets by name only): database migrations smoke test,
  lint/test split jobs, security scans.

## G. Verification log

| Date | Environment | Action | Result | Notes |
| --- | --- | --- | --- | --- |
| _pending_ | Production | `curl https://admin.easymo.com/` | 200 OK | _fill after first deploy_ |
| _pending_ | Production | Supabase anon auth check | Success | _fill_ |
| _pending_ | Preview | Preview deploy health check | Success | _fill_ |

- **Latest Production deployment ID:** _record from Vercel_
- **Latest Preview deployment ID:** _record from Vercel PR comment_

## H. Rollback procedures

- **Vercel:** Use `vercel rollback <deployment-id>` to revert instantly. Document the rolled-back deployment in the
  verification log.
- **Git:** `git revert <sha>` on the offending commit, push a new branch, obtain approval, and merge to redeploy.
- **Supabase:** Prefer down migrations stored alongside the up migrations. If unavailable, coordinate with DBA for
  point-in-time restore (PITR) according to Supabase plan; document timestamp and contacts.
- **Incident contacts:**
  - Primary: `INCIDENT_CONTACT` env value (see Section C).
  - Escalation: _add named individuals or rotation_.

## I. Outstanding items & assumptions

- Provide actual GitHub org/repo details and update Sections B & I accordingly.
- Supply Supabase project reference and region.
- Decide on Vercel analytics usage and production domain cutover date.
- Confirm license and security policy; add `LICENSE` and `SECURITY.md` when decisions are final.
- Once package manifest is present, ensure CI passes and update required status checks in GitHub branch
  protection.

---

### Runbooks

#### Add a new environment variable
1. Add the variable name and description to `.env.example` and update the matrix in Section C.
2. For GitHub Actions usage, run `gh secret set <NAME>` and store the value securely.
3. In Vercel, run `vercel env add <NAME> <env>` for each environment (Preview, Production).
4. If Supabase requires the value, update the project settings via dashboard or CLI.
5. Commit documentation updates referencing the change.

#### Redeploy workflow
1. Merge the approved PR into `main` (ensuring CI passed).
2. Vercel auto-deploys; monitor the deployment dashboard.
3. Run Supabase migrations (`supabase db push`) if the release includes schema changes.
4. Update the verification log (Section G) with deployment ID and smoke test results.

#### Rollback workflow
1. If Production deployment fails, run `vercel rollback <previous-deployment-id>`.
2. Create a hotfix branch that reverts or fixes the problematic commit.
3. If database changes were applied, execute the corresponding down migration or coordinate PITR with Supabase.
4. Document the incident in Section G and notify contacts listed above.
