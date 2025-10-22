# easyMO Deployment Final Report Template

Use this template to capture evidence that the GitHub → Supabase → self-hosted pipeline has been executed successfully. Store the completed report in `docs/deployment/status/` with a date-based filename (e.g., `2025-10-07.md`).

## 1. Repository & Branch Protection
- Repository URL:
- Default branch:
- Branch protection summary (required checks, review count, admin enforcement):
- Link to branch protection audit (screenshot or CLI output):

## 2. GitHub Actions CI
- Workflow file path:
- Last successful run URL:
- Required secrets/variables added (names only):

## 3. Supabase
- Project name & reference ID:
- Region:
- Date linked via `supabase link`:
- Latest migration IDs deployed:
- RLS status summary:
- Edge Functions deployed (if any):
- Smoke test evidence (command output / logs):

## 4. Hosting Platform
- Team / project URL:
- Preview deployment URL + ID:
- Production deployment URL + ID:
- Custom domain verification status:
- Analytics setting (On/Off):

## 5. Environment Variable Matrix Snapshot
| Name | Scope (Preview/Prod/Both) | Source of truth | Notes |
| --- | --- | --- | --- |

## 6. Verification Checklist
- [ ] `/` responds 200 on Production
- [ ] Static assets load without console errors
- [ ] Supabase anon client connects
- [ ] Critical API routes verified (list)
- [ ] Preview deployment validated with staging credentials

## 7. Rollback Preparedness
- Last verified rollback point:
- Git commit hash ready for revert:
- Supabase backup / PITR reference:
- Incident contacts notified of deployment:

## 8. Open Items
- Outstanding operator inputs or decisions:
- Follow-up tasks:

Attach this report to the PR or deployment ticket when requesting approval.
