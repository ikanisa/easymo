# EasyMOAI Auto-Sync Quick Start

## 🎯 What Was Set Up

Automatic synchronization from [easyMOAI](https://github.com/ikanisa/easyMOAI) to easymo- repository.

## 📅 Sync Schedule

- **Every 6 hours**: 00:00, 06:00, 12:00, 18:00 UTC
- **Automatic**: Creates PR when updates detected
- **Manual**: Trigger anytime via GitHub Actions

## 🚀 Quick Actions

### Trigger Manual Sync Now
```bash
# Via GitHub CLI
gh workflow run sync-easymoai.yml

# Or via GitHub UI
# Actions → Sync EasyMOAI Repository → Run workflow
```

### Check Sync Status
```bash
# View recent runs
gh run list --workflow=sync-easymoai.yml -L 5

# Check if sync needed
git fetch easymoai
git log main..easymoai/main --oneline
```

### Review Sync PR
```bash
# List open sync PRs
gh pr list --label sync,easymoai

# Checkout and test
gh pr checkout [PR-NUMBER]
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

## 📝 What Happens

1. **Every 6 hours**: Workflow checks for new easyMOAI commits
2. **If updates found**: 
   - Creates branch `sync/easymoai-YYYYMMDD-HHMMSS`
   - Merges changes (keeps easymo- config files)
   - Opens PR with details
3. **You review**: Check PR, test locally, merge or request changes

## 🔧 Conflict Resolution

**Automatically kept** (easymo- version):
- `.gitignore`
- `README.md`
- `package.json`
- `tsconfig.json`

**May need review**:
- Overlapping components
- Duplicate backend services
- Deployment config changes

## 📚 Full Documentation

See [docs/EASYMOAI_AUTO_SYNC.md](docs/EASYMOAI_AUTO_SYNC.md) for:
- Detailed workflow explanation
- Troubleshooting guide
- Webhook setup for instant sync
- Monitoring and maintenance

## ⚡ Push to Activate

```bash
git push origin main
```

After push, the workflow will:
- ✅ Be visible in GitHub Actions
- ✅ Run on schedule (every 6 hours)
- ✅ Be triggerable manually
- ✅ Create PRs when easyMOAI updates

## 🎛️ Control

### Pause Sync
```bash
gh workflow disable sync-easymoai.yml
```

### Resume Sync
```bash
gh workflow enable sync-easymoai.yml
```

### Remove Sync
```bash
rm .github/workflows/sync-easymoai.yml
git commit -m "remove auto-sync" && git push
```

---

**Status**: Ready to push  
**Next**: `git push origin main` to activate
