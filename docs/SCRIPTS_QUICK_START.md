# EasyMO Refactoring Scripts - Quick Start Guide

This guide explains how to use the automation scripts created during the Phase 3 & 4 refactoring.

---

## 📁 Script Locations

```
scripts/
├── audit/
│   └── observability-compliance.ts    # Check logging standards
├── maintenance/
│   ├── cleanup-root-directory.sh      # Organize repository
│   └── remove-stray-service-files.sh  # Archive orphaned files
├── security/
│   └── audit-env-files.sh             # Environment security
└── verify/
    └── workspace-deps.sh              # Workspace dependencies
```

---

## 🚀 Common Workflows

### Before Committing Code

```bash
# 1. Check workspace dependencies
./scripts/verify/workspace-deps.sh

# 2. Security audit
./scripts/security/audit-env-files.sh

# 3. Lint and type check
pnpm lint
pnpm type-check

# 4. Run tests
pnpm test
```

### Weekly Maintenance

```bash
# Clean up root directory (preview first)
./scripts/maintenance/cleanup-root-directory.sh --dry-run

# If looks good, execute
./scripts/maintenance/cleanup-root-directory.sh

# Check observability compliance
npx tsx scripts/audit/observability-compliance.ts
```

### Before CI/CD Pipeline Updates

```bash
# Ensure all internal packages use workspace protocol
./scripts/verify/workspace-deps.sh

# Verify no secrets in .env.example
./scripts/security/audit-env-files.sh
```

---

## 📖 Script Details

### 1. Workspace Dependencies Checker

**File**: `scripts/verify/workspace-deps.sh`

**Purpose**: Ensures all internal package dependencies use the `workspace:*` protocol.

**Usage**:
```bash
# Check compliance
./scripts/verify/workspace-deps.sh

# Auto-fix issues (if any)
./scripts/verify/workspace-deps.sh --fix
```

**What it checks**:
- ✅ All `@easymo/*` packages use `workspace:*`
- ✅ All `@va/*` packages use `workspace:*`
- ❌ Direct version numbers or wildcards

**Example Output**:
```bash
🔍 Verifying workspace dependencies...
✅ All workspace dependencies use correct protocol
```

---

### 2. Environment Security Auditor

**File**: `scripts/security/audit-env-files.sh`

**Purpose**: Prevents accidental secret exposure in environment files.

**Usage**:
```bash
./scripts/security/audit-env-files.sh
```

**What it checks**:
1. **Real secrets in .env files**
   - OpenAI API keys (`sk-...`)
   - JWT tokens (long base64 strings)
   - Slack tokens (`xoxb-...`)
   - GitHub tokens (`ghp_...`)
   - AWS keys (`AKIA...`)

2. **Client-exposed sensitive variables**
   - `NEXT_PUBLIC_SERVICE_ROLE` ❌
   - `VITE_ADMIN_TOKEN` ❌
   - `NEXT_PUBLIC_SECRET` ❌

3. **Git safety**
   - .env.local in .gitignore
   - .env.production in .gitignore
   - No .env files in git history

**Exit codes**:
- `0`: All checks passed ✅
- `1`: Critical security issues found ❌

---

### 3. Root Directory Cleanup

**File**: `scripts/maintenance/cleanup-root-directory.sh`

**Purpose**: Organizes root directory by moving files to appropriate locations.

**Usage**:
```bash
# Preview what would be moved (SAFE)
./scripts/maintenance/cleanup-root-directory.sh --dry-run

# Execute the cleanup
./scripts/maintenance/cleanup-root-directory.sh
```

**What it does**:

| File Pattern | Moved To | Description |
|--------------|----------|-------------|
| `*_COMPLETE*.md` | `docs/sessions/` | Session completion notes |
| `*_STATUS*.md` | `docs/sessions/` | Status reports |
| `*_SUMMARY*.md` | `docs/sessions/` | Session summaries |
| `*_VISUAL*.txt` | `docs/architecture/diagrams/` | Architecture diagrams |
| `App.tsx`, `index.tsx` | `.archive/orphaned/` | Orphaned source files |
| `*.log` | `.archive/old-scripts/` | Log files |

**Safety features**:
- ✅ Dry-run mode shows preview
- ✅ Creates archive index automatically
- ✅ Preserves all files (moves, not deletes)
- ✅ Color-coded output

**Example Output**:
```bash
========================================
  Root Directory Cleanup Script
========================================

⚠️  DRY RUN MODE - No files will be moved

📁 Session completion notes
   → Would move: PROJECT_COMPLETE.md → docs/sessions/
   
✓ Directory: docs/sessions
✓ Directory: docs/archive
```

---

### 4. Observability Compliance Checker

**File**: `scripts/audit/observability-compliance.ts`

**Purpose**: Enforces observability ground rules across all services.

**Usage**:
```bash
# Check compliance
npx tsx scripts/audit/observability-compliance.ts

# Auto-fix common issues (future feature)
npx tsx scripts/audit/observability-compliance.ts --fix
```

**What it checks**:
1. **Structured logging imports** (Required)
   ```typescript
   ✅ import { childLogger } from '@easymo/commons';
   ❌ // No logging imports
   ```

2. **No console.log usage** (Required)
   ```typescript
   ❌ console.log('Processing payment', data);
   ✅ log.info({ data }, 'Processing payment');
   ```

3. **Correlation ID patterns** (Recommended)
   ```typescript
   ✅ correlationId: req.headers['x-correlation-id']
   ⚠️  // No correlation ID found (warning only)
   ```

**Example Output**:
```bash
🔍 Checking observability compliance...

Found 47 files to check

❌ services/payment/handler.ts
   - Found console.log usage (should use structured logging)
   Suggestions:
   → Add: import { childLogger } from "@easymo/commons"
   → Replace console.log with log.info({ data }, "message")

==========================================
✅ Compliant: 45/47
❌ Issues: 2/47
==========================================
```

---

### 5. Stray Files Archiver

**File**: `scripts/maintenance/remove-stray-service-files.sh`

**Purpose**: Archives orphaned files from services/ directory after verification.

**Usage**:
```bash
./scripts/maintenance/remove-stray-service-files.sh
```

**What it does**:
1. Creates `.archive/services-stray/` directory
2. Copies files with timestamp
3. Checks for imports in codebase
4. Only removes if no active imports found

**Safety features**:
- ✅ Archives before removal
- ✅ Checks imports first
- ✅ Timestamped backups
- ✅ Clear error messages

---

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Code Quality Checks

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check workspace dependencies
        run: ./scripts/verify/workspace-deps.sh
      
      - name: Security audit
        run: ./scripts/security/audit-env-files.sh
      
      - name: Observability compliance
        run: npx tsx scripts/audit/observability-compliance.ts
```

---

## 🛠️ Troubleshooting

### Script not executable
```bash
chmod +x scripts/**/*.sh
```

### TypeScript script fails
```bash
# Install dependencies
pnpm install

# Or use npx
npx tsx scripts/audit/observability-compliance.ts
```

### Workspace check fails
```bash
# Auto-fix workspace dependencies
./scripts/verify/workspace-deps.sh --fix

# Then reinstall
pnpm install
```

---

## 📚 Related Documentation

- [Ground Rules](../GROUND_RULES.md) - Observability requirements
- [Refactoring Progress](../REFACTORING_PROGRESS.md) - Overall status
- [Phase 3 Status](./REFACTORING_SESSION_PHASE3_STATUS.md) - Task details
- [Session Summary](./REFACTORING_SESSION_2025-11-27_SUMMARY.md) - Complete summary

---

## 🎯 Best Practices

1. **Always run dry-run first**
   ```bash
   ./scripts/maintenance/cleanup-root-directory.sh --dry-run
   ```

2. **Check before committing**
   ```bash
   ./scripts/verify/workspace-deps.sh && \
   ./scripts/security/audit-env-files.sh && \
   pnpm lint
   ```

3. **Regular maintenance**
   - Run cleanup weekly
   - Check observability monthly
   - Audit security before releases

4. **CI/CD gates**
   - Workspace dependencies: Required
   - Security audit: Required
   - Observability: Warning only

---

## 💡 Tips

- All scripts support color output (disable with `NO_COLOR=1`)
- Exit codes follow Unix conventions (0=success, 1=error)
- Scripts are safe to run multiple times
- Dry-run modes never modify files

---

**Last Updated**: 2025-11-27  
**Maintainer**: DevOps Team  
**Scripts Version**: 1.0.0
