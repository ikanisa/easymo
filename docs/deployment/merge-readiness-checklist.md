# easyMO Deployment PR Merge Readiness Checklist

This checklist records the blockers that previously prevented the deployment playbook pull request from merging and documents how they are resolved in this revision. Re-run the checklist before every update to ensure idempotency.

## Summary of Prior Merge Blockers

| Blocker | Symptom | Resolution in this revision | Follow-up owner |
| --- | --- | --- | --- |
| Missing automation artifacts | Reviewers could not validate CI/CD wiring because the repository lacked concrete workflow files or runbooks. | Added merge-readiness checklist, runbooks, and templates capturing required automation inputs so reviewers can trace coverage. | DevOps |
| `.env.example` incomplete | Environment names in the docs did not align with Supabase/Netlify expectations, leading to conflicting manual edits in downstream branches. | Harmonized `.env.example` with the documented environment matrix and added CLI-related variables to avoid future merge conflicts. | Platform |
| Missing deployment evidence log | Operators lacked a standardized deliverable to confirm configuration, so reviews stalled on “what does done look like”. | Added deployment evidence guidance and the operator inputs template to enforce consistent reporting. | Release manager |

## Pre-Merge Validation Tasks

- [ ] Confirm `.env.example` aligns with Supabase and Netlify dashboards (names only, no values).
- [ ] Ensure branch protection requirements match the CI workflow name (`ci`) and Netlify checks.
- [ ] Verify the PR targets the canonical `main` branch and plan to fast-forward `work` after merge to keep both histories aligned.
- [ ] Verify Supabase CLI configuration (`supabase/config.toml`) is linked or pending operator input.
- [ ] Collect operator inputs using the template and attach to the PR description.
- [ ] Create a deployment evidence log (include repo URL, project refs, domains) and attach/link it in the PR description for reviewer context.

Mark each item completed in the PR description before requesting merge approval.
