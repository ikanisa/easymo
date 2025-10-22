# easyMO Deployment Runbooks

The following runbooks provide repeatable, auditable steps for operating the GitHub → Supabase → Vercel deployment pipeline without exposing secrets.

## 1. Add or Rotate an Environment Variable

1. Update `.env.example` if a new variable name is introduced (names only).
2. In GitHub → *Settings → Secrets and variables → Actions*, add/update the secret or variable.
3. In Vercel → *Settings → Environment Variables*, add/update the variable in both Preview and Production scopes as required.
4. If the variable belongs to Supabase, run `supabase secrets set --project-ref <ref> --env <env> <NAME> <VALUE>` locally (value entered interactively).
5. Document the change in the final report template and notify the team via the incident contact channel.

## 2. Redeploy the Application

1. Ensure the `ci` GitHub Actions workflow is green on the target branch.
2. Trigger a Vercel deployment:
   - Preview: push to a feature branch, or run `vercel deploy --prebuilt`.
   - Production: merge to default branch or run `vercel deploy --prod`.
3. Monitor Vercel build logs until success.
4. Execute the verification checklist from `production-pipeline.md` (HTTP 200, assets load, Supabase smoke test).
5. Record deployment ID(s) in the final report.

## 3. Roll Back a Deployment

1. Identify the last known good Vercel deployment in the dashboard and click **Promote to Production**.
2. Revert the offending Git commit locally (`git revert <sha>`) and push to the default branch.
3. If database changes were applied, execute the corresponding down migration: `supabase migration down --env prod`.
4. Notify incident contacts with summary and next steps.

## 4. Link Repository to Supabase (Initial Setup)

1. Navigate to `supabase/` and run `supabase link --project-ref <ref>` (requires `SUPABASE_ACCESS_TOKEN`).
2. Commit the generated `.supabase/config.toml` file.
3. Run `supabase status` to confirm linkage; capture output in the final report.
4. Create a baseline migration with `supabase migration new init` and commit the SQL file.

## 5. Configure Branch Protections

1. Ensure the GitHub Actions workflow file exists at `.github/workflows/ci.yml`.
2. Use GitHub CLI (requires `GITHUB_TOKEN` with admin scope):
   ```bash
   gh api \
     --method PUT \
     -H "Accept: application/vnd.github+json" \
     /repos/<org>/<repo>/branches/<default-branch>/protection \
     -f required_status_checks='{"strict":true,"contexts":["ci","Vercel (Preview)"]}' \
     -f required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
     -f enforce_admins=true \
     -F restrictions='null'
   ```
3. Record the applied policy in the final report.

These runbooks are idempotent; running them multiple times maintains or refreshes configuration without duplication.
