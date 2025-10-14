# easymo-admin Deployment Playbook

This playbook explains how to move changes from pull request to production
using the provided GitHub Actions workflow. It complements the configuration
templates in this directory and should live in the root of the new
`easymo-admin` repository once copied.

## 1. Required CI checks

The workflow defined in `github-actions-nextjs.yml` produces two required
contexts. Enable them as branch protection rules on `main` so that merges
cannot proceed unless both succeed:

| Context | What it runs |
| --- | --- |
| `CI / install-and-test` | Installs dependencies with the detected package manager, runs lint, unit tests, and builds the Next.js app. |
| `CI / verify-migrations` | Re-installs tooling and executes `supabase db lint` (or your alias) to ensure migrations are safe to apply. |

> Tip: if you rename the workflow or jobs, update branch protection rules to
> use the new context names before merging.

## 2. Promotion flow

1. Open a pull request. The workflow runs on every push and on the PR. Wait for
   both required contexts to pass.
2. Once reviewed, merge into `main`. This triggers the workflow again on the
   default branch, producing the same artifacts.
3. Download the build artifact from the latest `CI / install-and-test` run.
   - Static export platforms can deploy the artifact directly.
   - For serverful hosts, promote the commit SHA associated with the workflow
     run through your hosting provider.
4. Deploy updated Supabase migrations using `supabase db push` or your release
   automation once `CI / verify-migrations` passes.

Document the exact hosting platform promotion steps (CLI commands or dashboard
links) in your repository’s `RUNBOOK.md` so on-call engineers can execute them.

## 3. Secrets matrix

Maintain a secrets inventory alongside this playbook to avoid merge blockers
when onboarding new environments. At minimum ensure:

- GitHub repository secrets contain the Supabase keys referenced by the
  workflow.
- The hosting platform mirrors the same keys for runtime usage.
- Supabase CLI access tokens are scoped to a service account, not a personal
  user.

## 4. Rollback plan

1. Revert the offending commit on `main` (via GitHub UI or locally) and wait
   for CI to complete.
2. Redeploy the previous artifact from the workflow associated with the revert.
3. If migrations were applied, run the appropriate rollback script or deploy a
   compensating migration.
4. Announce the rollback in the support channel and update the incident log.

Record runbook links for migrations and hosting rollback commands next to this
file to keep the procedure actionable.
