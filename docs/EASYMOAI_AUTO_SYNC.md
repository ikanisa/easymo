# EasyMOAI Auto-Sync Setup

This document describes the automatic synchronization between the [easyMOAI](https://github.com/ikanisa/easyMOAI) repository and the easymo- repository.

## Overview

The `sync-easymoai` GitHub Actions workflow automatically monitors the easyMOAI repository and creates pull requests when new changes are detected.

## How It Works

### Automatic Sync Schedule
- **Frequency**: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- **Workflow**: `.github/workflows/sync-easymoai.yml`
- **Action**: Creates a PR when new commits are found in easyMOAI

### Sync Process

1. **Fetch Updates**
   - Checks easyMOAI repository for new commits
   - Compares with last synced commit in easymo-

2. **Create Sync Branch**
   - If updates found, creates a new branch: `sync/easymoai-YYYYMMDD-HHMMSS`

3. **Merge Changes**
   - Attempts automatic merge with `--allow-unrelated-histories`
   - Uses `--strategy-option=ours` to prefer easymo- versions for conflicts

4. **Resolve Conflicts**
   - Automatically keeps easymo- versions of:
     - `.gitignore`
     - `README.md`
     - `package.json`
     - `tsconfig.json`
   - Other conflicts are merged or flagged for manual review

5. **Create Pull Request**
   - Opens a PR with sync details
   - Labels: `sync`, `automated`, `easymoai`
   - Includes conflict resolution notes

## Manual Triggers

### Via GitHub UI
1. Go to **Actions** tab
2. Select **Sync EasyMOAI Repository** workflow
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow** button

### Via GitHub CLI
```bash
gh workflow run sync-easymoai.yml
```

### Via API/Webhook (for easyMOAI repository)
From easyMOAI repository, you can trigger sync on push:

```yaml
# Add to easyMOAI/.github/workflows/notify-easymo.yml
name: Notify EasyMO on Push

on:
  push:
    branches: [main]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger easymo- sync
        run: |
          curl -X POST \
            -H "Accept: application/vnd.github.v3+json" \
            -H "Authorization: token ${{ secrets.EASYMO_SYNC_TOKEN }}" \
            https://api.github.com/repos/[YOUR-ORG]/easymo-/dispatches \
            -d '{"event_type":"easymoai-updated"}'
```

## Configuration

### Required Secrets
The workflow uses `GITHUB_TOKEN` which is automatically provided by GitHub Actions. No additional secrets needed for basic functionality.

### Optional: Cross-Repository Trigger
To enable immediate sync when easyMOAI is updated:

1. Create a Personal Access Token (PAT) in easymo- repository with `repo` scope
2. Add it as `EASYMO_SYNC_TOKEN` secret in easyMOAI repository
3. Add the notify workflow shown above to easyMOAI

## Reviewing Sync PRs

When a sync PR is created:

### 1. Check the PR Description
- Review source commit hash
- Check merge status (success vs. success_with_conflicts)
- Note which files had conflicts

### 2. Review Changed Files
```bash
gh pr checkout [PR-NUMBER]
git diff main...HEAD
```

### 3. Test Locally
```bash
# Install and build
pnpm install --frozen-lockfile
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm build

# Run tests
pnpm lint
pnpm exec vitest run
cd admin-app && npm test -- --run
```

### 4. Merge or Request Changes
- ✅ **Auto-merge** if no conflicts and tests pass
- 🔍 **Review carefully** if conflicts were resolved
- ❌ **Close & manual merge** if significant issues

## Conflict Resolution Strategy

### Automatic (Preferred easymo- versions)
- `.gitignore` - Keeps easymo- ignore patterns
- `README.md` - Keeps easymo- main documentation
- `package.json` - Keeps easymo- monorepo config
- `tsconfig.json` - Keeps easymo- TypeScript config

### Manual Review Required
Files that may need manual merge:
- New components that overlap with existing ones
- Backend services that duplicate functionality
- Deployment configs that conflict

## Monitoring

### Check Workflow Status
```bash
# List recent workflow runs
gh run list --workflow=sync-easymoai.yml

# View specific run
gh run view [RUN-ID]

# View logs
gh run view [RUN-ID] --log
```

### Check Sync Status
```bash
# View easyMOAI remote
git remote -v | grep easymoai

# Check last synced commit
git log --oneline --grep="sync updates from easyMOAI" -n 5

# Compare current main with easyMOAI
git fetch easymoai
git log main..easymoai/main --oneline
```

## Troubleshooting

### Workflow Not Running
**Check**:
- Workflow file syntax: `.github/workflows/sync-easymoai.yml`
- GitHub Actions enabled for repository
- Branch protection rules don't block bot commits

**Fix**:
```bash
# Validate workflow syntax
gh workflow view sync-easymoai.yml

# Manually trigger
gh workflow run sync-easymoai.yml
```

### Merge Conflicts Not Resolved
**Symptoms**: PR created but has unresolved conflicts

**Resolution**:
```bash
# Checkout the sync branch
gh pr checkout [PR-NUMBER]

# Manually resolve conflicts
git status
# Edit conflicted files

# Complete merge
git add .
git commit -m "resolve: manual conflict resolution"
git push
```

### Duplicate Files
**Symptoms**: easyMOAI files conflict with existing easymo- files

**Resolution**:
- Decide which version to keep
- Update `.gitignore` or merge file contents
- Commit resolution to sync PR

### Failed Workflow
**Check logs**:
```bash
gh run list --workflow=sync-easymoai.yml --status=failure
gh run view [RUN-ID] --log
```

**Common issues**:
- Network timeout → Will retry on next schedule
- Permission denied → Check `GITHUB_TOKEN` permissions
- Merge failure → Requires manual intervention

## Disabling Auto-Sync

### Temporary (Pause)
```bash
# Disable workflow
gh workflow disable sync-easymoai.yml

# Re-enable later
gh workflow enable sync-easymoai.yml
```

### Permanent (Remove)
```bash
rm .github/workflows/sync-easymoai.yml
git commit -m "chore: remove easyMOAI auto-sync"
git push
```

### Remove Remote
```bash
git remote remove easymoai
```

## Best Practices

1. **Review PRs Promptly**: Sync PRs should be reviewed within 24 hours
2. **Test Before Merge**: Always run builds and tests locally
3. **Keep Conflicts Minimal**: Coordinate with easyMOAI maintainers on major changes
4. **Document Divergence**: If easymo- significantly diverges, document why
5. **Monitor Failed Syncs**: Check workflow failures and resolve quickly

## Integration Notes

### Files from easyMOAI
- **Backend services**: `backend/` (Python FastAPI)
- **Components**: `components/` (React/TypeScript)
- **Services**: `services/` (Audio, Gemini AI)
- **Infrastructure**: Deployment configs, Terraform, Cloud Build

### easymo- Preserved Files
- **Monorepo config**: `package.json`, `pnpm-workspace.yaml`
- **TypeScript config**: `tsconfig.json`, `tsconfig.*.json`
- **Documentation**: `README.md`, `docs/`
- **Build configs**: `.gitignore`, `vite.config.ts`

## Support

For issues with auto-sync:
1. Check this documentation
2. Review workflow logs
3. Check recent sync PRs for similar issues
4. Create an issue with `[auto-sync]` prefix

---

**Last Updated**: 2025-11-21  
**Workflow Version**: 1.0  
**Maintainer**: DevOps Team
