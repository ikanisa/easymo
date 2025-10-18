# Go-Live Readiness Baseline (Phase 0)

_Generated: 2025-10-18 (phase 0); updated after Phase 1 alignment_

This note captures the current state of the EasyMO repository and the configuration artefacts we can audit locally. It serves as the starting point for the multi-phase go-live plan.

## 1. Repository & Branches

- `main` is up to date with `origin/main` (checked out and rebased before starting work).
- Branch `phase2-setup` continues to exist with additional commits; no changes were merged into `main` as part of this pass.
- Working tree is clean after restoring an accidental change to `admin-app/package-lock.json`.

## 2. Environment Artefacts

- **Root `.env`** still references the legacy Supabase project (`ezrriefbmhiiqfoxgjgz`) and associated anon key/token values. This file is out of sync with the active project (`lhbowpbcpwoiparwnwgt`) and should not be used as-is.
- **`.env.local`** (created by Vercel CLI) contains working credentials for the new project, including:
  - `NEXT_PUBLIC_SUPABASE_URL` set to `https://lhbowpbcpwoiparwnwgt.supabase.co`.
  - A populated `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_ACCESS_CREDENTIALS`, `ADMIN_SESSION_SECRET`, `ADMIN_TOKEN`, OpenAI key, reminder toggles, etc.
  - Because this file holds active secrets, it should be rotated or removed from version control once centralised secret management is in place.
- **`.env.example` / `.env.sample`** provide skeleton values but still point to the old project; they need updating to the new Supabase IDs.
- **`.vercel/project.json`** confirms the linked project ID (`prj_OR78kyqEL69DwKpsNI5dCAoOS5HY`) but does not expose environment variables.
- **`.supabase/access-token`** indicates the CLI is authenticated locally; however, without the corresponding service role password we can’t run remote introspection commands yet.

## 3. Supabase Local Config Snapshot

From `supabase/config.toml`:

- `project_id = "lhbowpbcpwoiparwnwgt"` ✅
- `[auth] site_url` remains `http://localhost:56311` with no additional redirect URLs configured. The Supabase dashboard must be updated to production/preview URLs before go-live.
- Database major version is 17; ports are default (57322/57323 shadow).
- No storage buckets are declared here—these are managed remotely.

## 4. Policies, Cron, Storage – What We Can Infer

- A scan of the migrations shows **55 occurrences** of `enable row level security`. This confirms intent, but we still need to verify the live database actually has RLS enabled/policies applied (requires Supabase CLI access with service credentials).
- We do not have local evidence of storage bucket creation. Environment variables reference `insurance-docs`, `kyc-documents`, `menu-source-files`, `ocr-json-cache`, suggesting the expected bucket names. Confirmation must happen in the Supabase dashboard.
- Cron schedules (e.g., for reminder functions) cannot be listed without `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_URL`. Phase 1 should explicitly run `supabase cron list` and capture the current configuration.
- Edge functions are present in the repo (`supabase/functions/*`), but we haven’t exercised them yet. Testing will happen in Phase 3.

## 5. Phase 1 Adjustments Completed

- Replaced the tracked `.env` with a sanitized template targeting the active Supabase project (`lhbowpbcpwoiparwnwgt`) and documented every required variable. `.env.example` mirrors the new structure.
- Added `docs/env/phase2-env-alignment.md` with a full checklist for synchronising Vercel, Supabase edge function secrets, and admin session tokens.
- Updated `supabase/config.toml` so that the local auth configuration mirrors the desired production Site URL (`https://easymo.vercel.app`) and includes preview/local redirect URLs.
- Confirmed that `.env.local` still holds the live secrets; these should be rotated into the secret manager when ready.

## 6. Outstanding Information (Phase 2+ follow-up)

| Area                | Action                                                                                              |
|---------------------|-----------------------------------------------------------------------------------------------------|
| Vercel environment  | Export current env vars (especially admin tokens, dispatcher URL) and reconcile with `.env.local`. |
| Supabase auth       | Update Site URL & Redirect URLs directly in the Supabase dashboard (pending access).               |
| Storage             | List existing buckets and create missing ones (`vouchers`, `kyc-documents`, etc.).                 |
| Cron jobs           | Use `supabase cron list` to confirm reminder/notification schedules.                                |
| RLS verification    | Run policy audits against the live database (e.g., `supabase db remote commit` or custom queries). |

This baseline completes Phase 0: we have the current artefacts catalogued and gaps identified so that Phase 1 can focus on aligning environment variables and authentication.
