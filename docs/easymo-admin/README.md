# easymo-admin Templates

This directory collects starter configuration files that can be copied into a new `easymo-admin` repository. The templates assume a Next.js application deployed on Vercel with Supabase as the primary backend. Each file is heavily commented so you can tailor it to your own needs before committing to the new project.

## Files included

- [`github-actions-nextjs.yml`](./github-actions-nextjs.yml) – CI pipeline template that lints, tests, builds, and validates Supabase migrations with PNPM on Node 18.
- [`vercel.json`](./vercel.json) – Vercel project configuration aligned with the desired deployment strategy (preview deployments for PRs, production on `main`).
- [`supabase/migrations/0001_create_core_tables.sql`](./supabase/migrations/0001_create_core_tables.sql) – Example additive SQL migration that creates common auth, profile, and auditing tables with row level security.

## How to use the templates

1. **Copy the files** into the matching locations of the new repository (for example, place the GitHub Action under `.github/workflows/`).
2. **Update placeholders** such as email domains, organization names, and URL allowlists before committing.
3. **Wire the required secrets and environment variables** in GitHub, Supabase, and Vercel. The tables below provide a checklist for each platform.

### GitHub repository checklist

| Task | Notes |
| --- | --- |
| Create private repo `easymo-admin` | MIT license, Node `.gitignore`.
| Add branch protection on `main` | Require ≥1 review, passing Vercel check, block force-pushes/deletions.
| Configure Dependabot & CodeQL | Enable security alerts and the default code scanning workflow.
| Store secrets | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_EDGE_FUNCTIONS_REGION`, plus `SUPABASE_ACCESS_TOKEN` if you use the migration job.

### Supabase project checklist

| Task | Notes |
| --- | --- |
| Create project `easymo-admin` in `eu-west-1` | Start with a blank database.
| Link Supabase CLI | `supabase link --project-ref <PROJECT_REF>` (store the access token securely).
| Apply initial migration | `supabase db push` after reviewing `0001_create_core_tables.sql`.
| Configure JWT & anon keys | Copy `anon`, `service_role`, and `jwt_secret` into GitHub/Vercel secrets.
| Set edge function region | Match `SUPABASE_EDGE_FUNCTIONS_REGION` to `eu-west-1` unless you deploy elsewhere.

### Vercel project checklist

| Task | Notes |
| --- | --- |
| Import repo to Vercel | Framework preset: Next.js, Node 18.
| Configure build | Build command `pnpm run build`, output `.vercel/output` (matches `vercel.json`).
| Map environment variables | Provide the Supabase values for production, preview, and build environments (see the secret names referenced in `vercel.json`).
| Set preview & production rules | Preview on every PR; production on merges to `main`.
| Enable image optimization | Default for Next.js – no extra config needed.

### Environment variable reference

Provide these values through secrets or dashboard configuration rather than committing sensitive data.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_EDGE_FUNCTIONS_REGION`
- `SUPABASE_ACCESS_TOKEN` (GitHub Actions only)
- `VERCEL_ENV`
- Vercel preview aliases such as `@next_public_supabase_url_preview` (configure via the Vercel dashboard)
- `NEXTAUTH_URL` (optional, if you use NextAuth.js)
- `NEXTAUTH_SECRET` (optional, if you use NextAuth.js)
- Any application-specific keys such as messaging providers, analytics, or third-party API credentials.

Keep this document alongside the templates so that future contributors understand how the configuration pieces fit together.
