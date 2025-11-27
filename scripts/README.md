# EasyMO Scripts Directory

Automation scripts for the EasyMO platform refactoring and maintenance.

## 📁 Directory Structure

```
scripts/
├── verify/          # ✅ Verification and validation scripts (NEW)
├── security/        # 🔐 Security audit scripts (NEW)
├── maintenance/     # 🔧 Cleanup and maintenance scripts (NEW)
├── migration/       # 📦 Code migration scripts (NEW)
├── codemod/         # 🔄 Automated code transformations (NEW)
├── audit/           # 📊 Compliance and quality audits (NEW)
├── checks/          # ✓ Pre-commit and CI checks (NEW)
├── deploy/          # 🚀 Deployment scripts (organized)
└── test/            # 🧪 Test runner scripts (organized)
```

## 🚀 Quick Start

### Refactoring Scripts (2025-11-27)

#### 1. Verify Workspace Dependencies
```bash
./scripts/verify/workspace-deps.sh
```
Ensures all internal packages use the `workspace:*` protocol.

#### 2. Security Audit
```bash
./scripts/security/audit-env-files.sh
```
Checks environment files for exposed secrets and sensitive variables.

#### 3. Clean Root Directory
```bash
# See what would change (recommended first)
./scripts/maintenance/cleanup-root-directory.sh --dry-run

# Apply changes
./scripts/maintenance/cleanup-root-directory.sh
```
Organizes root directory files into appropriate subdirectories.

## 📋 Script Reference

### ✅ Verification (`verify/`)

**workspace-deps.sh** - Verify workspace dependencies
- Checks all package.json files for proper `workspace:*` protocol
- Exit 0: All correct | Exit 1: Issues found

### 🔐 Security (`security/`)

**audit-env-files.sh** - Security audit for environment files
- Detects real secrets in `.env.example`
- Flags sensitive vars exposed via `NEXT_PUBLIC_` or `VITE_`
- Validates `.gitignore` configuration
- Exit 0: Secure | Exit 1: Issues found

### 🔧 Maintenance (`maintenance/`)

**cleanup-root-directory.sh** - Organize root directory
- Moves session notes → `docs/sessions/`
- Moves architecture diagrams → `docs/architecture/diagrams/`
- Moves deployment scripts → `scripts/deploy/`
- Moves test scripts → `scripts/test/`
- Archives old files → `.archive/`
- Supports `--dry-run` mode

## 💡 Usage Guidelines

### For All Scripts

1. **Read the script first** - Understand what it does
2. **Use --dry-run** - When available, test first
3. **Check exit codes** - 0 = success, 1 = failure
4. **Review output** - Verify changes match expectations

### Script Development

#### Template
```bash
#!/bin/bash
set -euo pipefail

echo "🔧 Script description"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "⚠️  DRY RUN MODE"
fi

# Script logic here

# Exit with proper code
exit 0  # or 1 for errors
```

#### Best Practices
- ✅ Use `set -euo pipefail` for safety
- ✅ Provide `--dry-run` for destructive operations
- ✅ Use color-coded output (see existing scripts)
- ✅ Include usage examples in comments
- ✅ Handle errors gracefully
- ✅ Document in this README

## 📚 Related Documentation

- **Refactoring Progress**: `/REFACTORING_PROGRESS.md`
- **Ground Rules**: `/docs/GROUND_RULES.md`
- **Architecture**: `/docs/ARCHITECTURE.md`

## 🆘 Troubleshooting

### "Permission denied"
```bash
chmod +x scripts/path/to/script.sh
```

### "Command not found: jq"
Install jq: 
- macOS: `brew install jq`
- Linux: `apt install jq`

### Script Fails Midway
1. Check error message
2. Run with `--dry-run` first
3. Verify prerequisites
4. Check file permissions

## 🔄 Migration Status

**Phase**: Code Quality & Standardization (Week 3)  
**Last Updated**: 2025-11-27

### Completed
- ✅ Admin app duplication resolution
- ✅ Workspace dependency verification
- ✅ Security audit infrastructure
- ✅ Root directory cleanup automation

### In Progress
- ⏳ Test framework standardization
- ⏳ TypeScript version alignment
- ⏳ ESLint zero-warning enforcement

---

**Maintained By**: EasyMO DevOps Team  
**Version**: 2.0 (Refactoring Edition)
