# Bootstrap procedure (GitHub ⇄ Supabase ⇄ Vercel)

This playbook wires the repository to the production stack. Re-run it at any time to refresh credentials or
validate configuration; the steps are idempotent when using the recommended CLI commands.

## 1. GitHub repository

1. Authenticate with the GitHub CLI: `gh auth login`.
2. Create or link the repository:
   - New repo: `gh repo create <org>/<repo> --private --source=. --push --disable-wiki`.
   - Existing repo: `gh repo set-default <org>/<repo>` and push the current branch.
3. Enable branch protections (replace `main` if different):
   ```bash
   gh api \
     --method PUT \
     -H "Accept: application/vnd.github+json" \
     "/repos/<org>/<repo>/branches/main/protection" \
     -F required_status_checks='{"strict":true,"contexts":["CI (build-test)"]}' \
     -F enforce_admins=true \
     -F required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
     -F restrictions='null'
   ```
4. Disable force pushes and deletions: already covered by the protection above.
5. Upload the PR template (committed in this repo) and ensure "Require a pull request before merging" is on.
6. Register required secrets in the repository (no values checked into git):
   ```bash
   gh secret set SUPABASE_SERVICE_ROLE_KEY
   gh secret set SUPABASE_DB_PASSWORD
   gh secret set INCIDENT_CONTACT
   # Add any additional secrets listed in docs/deployment/final-report.md
   ```

## 2. Supabase project

1. Install the Supabase CLI: https://supabase.com/docs/guides/cli.
2. Log in: `supabase login` (opens browser to authenticate).
3. Link to the target project:
   ```bash
   supabase link --project-ref <project_ref>
   ```
   - Stores the ref in `supabase/.supabase` so subsequent commands automatically target the project.
4. Pull the latest database schema (safe, idempotent):
   ```bash
   supabase db pull --schema public --debug
   ```
5. Manage migrations through versioned files under `supabase/migrations`:
   - Create: `supabase migration new <descriptive-name>`
   - Apply locally: `supabase db reset`
   - Deploy to remote (after PR approval): `supabase db push`
6. Edge Functions (if needed): place source under `supabase/functions/<function-name>/` and deploy via
   `supabase functions deploy <function-name> --project-ref <project_ref>`.
7. Verify Row-Level Security (RLS) settings using `supabase db policies list` and record outcomes in the final
   report.

## 3. Vercel project

1. Install Vercel CLI: `npm install -g vercel`.
2. Authenticate: `vercel login`.
3. Link the local repo to the Vercel project:
   ```bash
   vercel link --project <project-name> --scope <team-or-user>
   ```
   - For monorepo layout, run the command from the `admin-app` directory or pass `--cwd admin-app`.
4. Configure project settings via CLI (safe to re-run):
   ```bash
   vercel project edit <project-name> \
     --framework nextjs \
     --output-directory .next \
     --root-directory admin-app \
     --build-command "pnpm install --frozen-lockfile && pnpm build" \
     --prod-env NEXT_PUBLIC_SUPABASE_URL=@supabase-url \
     --prod-env NEXT_PUBLIC_SUPABASE_ANON_KEY=@supabase-anon \
     --prod-env SUPABASE_SERVICE_ROLE_KEY=@supabase-service-role \
     --prod-env SUPABASE_JWT_SECRET=@supabase-jwt \
     --prod-env SUPABASE_DB_PASSWORD=@supabase-db-password \
     --prod-env NEXT_PUBLIC_APP_URL=@app-url \
     --env NEXT_PUBLIC_SUPABASE_URL=@supabase-url \
     --env NEXT_PUBLIC_SUPABASE_ANON_KEY=@supabase-anon \
     --env NEXT_PUBLIC_APP_URL=@app-url \
     --env INCIDENT_CONTACT=@incident-contact
   ```
   - Replace `@secret-name` with Vercel environment variable references. Preview env inherits from `--env` flags.
5. Enable Vercel ↔ GitHub integration through the Vercel dashboard (Project Settings → Git). Select the same
   repository and grant permissions for previews on pull requests.
6. Configure production domain: `vercel domains add admin.easymo.com` (replace with real domain).
7. Optional: enable Vercel Analytics in the dashboard (Production only).

## 4. Post-bootstrap verification

1. Push a branch to GitHub; confirm the `CI (build-test)` workflow runs.
2. Create a test pull request and confirm Vercel posts a Preview deployment URL and GitHub reports the status
   check.
3. Run `supabase status` to ensure the CLI can reach the project and migrations are up to date.
4. Update `docs/deployment/final-report.md` with any new URLs, IDs, or contacts discovered during setup.

## 5. Idempotency guidance

- Re-running the GitHub branch protection command simply reapplies the desired policy.
- `supabase link` updates the local config; it is safe if already linked.
- `vercel project edit` overwrites settings atomically, so repeating the command realigns drift without
  duplication.
