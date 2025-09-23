# easymo-admin Templates

This directory collects starter configuration files that can be copied into a new `easymo-admin` repository. The templates assume a Next.js application deployed on Vercel with Supabase as the primary backend. Each file is heavily commented so you can tailor it to your own needs before committing to the new project.

## Contents

- [`github-actions-nextjs.yml`](./github-actions-nextjs.yml) – CI pipeline template that lint/build/test the Next.js app with PNPM and uploads build artifacts for inspection.
- [`vercel.json`](./vercel.json) – Vercel project configuration aligned with the deployment strategy described in the planning notes.
- [`supabase/migrations/0001_create_core_tables.sql`](./supabase/migrations/0001_create_core_tables.sql) – Example additive SQL migration that creates common auth and profile tables and policies.

To use these templates:

1. Copy the file into the matching location of the new repository (for example, place the GitHub Action under `.github/workflows/`).
2. Read through the inline comments and update placeholders (e.g., email domains, project IDs, and URL allowlists) before committing.
3. If you add new environment variables or database objects, make sure to update the Supabase policies and Vercel configuration accordingly.

## Environment variables reference

The templates refer to the following environment variables. Provide values through the GitHub repository secrets, Supabase project settings, and the Vercel dashboard rather than committing sensitive data.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_EDGE_FUNCTIONS_REGION`
- `VERCEL_ENV`
- `NEXTAUTH_URL` (optional, if you use NextAuth.js)
- `NEXTAUTH_SECRET` (optional, if you use NextAuth.js)
- Any application-specific keys such as messaging providers, analytics, or third-party API credentials.

Keep this document alongside the templates so that future contributors know how the configuration pieces fit together.
