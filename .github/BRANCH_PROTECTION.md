Branch Protection – main
=================================

Use GitHub branch protection (or repository rulesets) to require CI jobs and reviews before merging to `main`.

Recommended required status checks
- Validate + Build Packages
- Build Backend Apps
- Build + Test Admin App
- Monorepo Build (reduced concurrency)
- Typecheck Packages & Apps
- Lint Monorepo

Steps (via GitHub UI)
1. Settings → Branches → Branch protection rules → Add rule.
2. Branch name pattern: `main`.
3. Enable “Require status checks to pass before merging”.
4. Search and select the six jobs listed above.
5. (Optional) Require pull request reviews and dismiss stale approvals on new commits.
6. Save changes.

Alternatively (for orgs with rulesets): Settings → Rules → New ruleset → Target: `main` → add status checks.

Optional: CLI helper
If you prefer the CLI and have `gh` authenticated with admin permissions, see `.github/scripts/configure-branch-protection.sh`.

