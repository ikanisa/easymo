Title: Merge: Reconcile active branches into main

Please review the attached Integration Report for full context:

- Report: .ci/INTEGRATION_REPORT.md
- Key areas:
  - Branches rebased/merged and conflict policies applied
  - Dependency actions and shared package builds
  - Admin-app typecheck/build/test results
  - Prisma validation status
  - CI jobs and required checks

Acceptance checklist
- [ ] CI green for jobs:
  - [ ] Validate + Build Packages
  - [ ] Build Backend Apps
  - [ ] Build + Test Admin App
  - [ ] Monorepo Build (reduced concurrency)
- [ ] Prisma validate passes
- [ ] Lockfiles and package.json in sync (no manual edits)
- [ ] No force pushes to `main`

Post-merge follow-ups
- Enable branch protection on `main` to require the four jobs above.
- Monitor CI for resource usage and adjust concurrency if needed.
