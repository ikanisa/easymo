# Refactoring Scripts

This directory contains scripts for the World-Class Repository Refactoring initiative.

## 📋 Available Scripts

### Phase 1: Root Directory Cleanup ✅ COMPLETE
```bash
./scripts/refactor/phase1-root-cleanup.sh
```
- Archives orphan files and backups
- Ensures documentation structure exists
- Creates timestamped archive directories

### Phase 2: Edge Function Analysis 🔄 READY
```bash
./scripts/refactor/phase2-analyze-functions.sh
```
- Counts total edge functions (current: 121)
- Lists webhooks, agents, and admin functions
- Identifies archived directories for removal
- Provides consolidation recommendations

### Phase 3: Package Analysis 📋 READY
```bash
./scripts/refactor/phase3-analyze-packages.sh
```
- Analyzes all packages (current: 35)
- Groups merge candidates by category
- Shows consolidation opportunities
- Recommends target package structure

### Phase 4: Configuration Analysis 📋 READY
```bash
./scripts/refactor/phase4-analyze-config.sh
```
- Searches for hardcoded configuration values
- Identifies phone numbers, limits, timeouts
- Provides remediation guidance
- Recommends dynamic configuration approach

### CI Quality Gate ✅ ACTIVE
```bash
./scripts/refactor/check-root-directory.sh
```
- **Used in CI/CD pipeline**
- Enforces root directory cleanliness
- Exits with error code 1 if violations found
- Provides fix instructions for violations

## 🚀 Usage

### For Contributors
Run quality check before committing:
```bash
./scripts/refactor/check-root-directory.sh
```

### For Maintainers
Analyze current state:
```bash
# All phases at once
./scripts/refactor/phase2-analyze-functions.sh
./scripts/refactor/phase3-analyze-packages.sh
./scripts/refactor/phase4-analyze-config.sh

# Or individually as needed
```

## 📊 Integration with CI

The `check-root-directory.sh` script runs automatically in GitHub Actions:
- On every push to main/develop
- On every pull request
- Prevents merging if root directory has violations

## 📁 Output & Artifacts

### Archives
Created by cleanup scripts in `.archive/root-cleanup-<timestamp>/`

### Reports
Analysis scripts output to stdout - redirect to save:
```bash
./scripts/refactor/phase2-analyze-functions.sh > docs/FUNCTION_INVENTORY.md
```

## 📚 Documentation

- **Progress Tracker:** `docs/REFACTORING_PROGRESS.md`
- **Quick Start:** `docs/REFACTORING_QUICKSTART.md`
- **Phase 1 Complete:** `docs/sessions/completed/PHASE1_REFACTORING_COMPLETE.md`

## 🎯 Goals

Transform the repository to achieve:
- Root directory: <20 config files only
- Edge functions: ~80-90 (from 121)
- Packages: ~20 (from 35)
- Hardcoded values: 0
- CI pass rate: 100%

## 🤝 Contributing

When adding refactoring scripts:
1. Follow naming convention: `phase<N>-<action>.sh`
2. Make executable: `chmod +x <script>.sh`
3. Add error handling: `set -e`
4. Provide clear output with emoji indicators
5. Update this README

## 📞 Support

Questions about refactoring? See:
- `docs/REFACTORING_PROGRESS.md` for current status
- `docs/REFACTORING_QUICKSTART.md` for quick reference
- Create GitHub issue with `refactoring` label

---

**Last Updated:** 2025-12-10  
**Status:** Phase 1 Complete ✅
