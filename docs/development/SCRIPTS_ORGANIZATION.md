# Scripts Directory Organization Guide

**Location:** `/scripts/`  
**Purpose:** Centralized repository for all operational, deployment, testing, and maintenance scripts  
**Last Updated:** December 10, 2025

## 📁 Directory Structure

### Core Categories

#### `scripts/deploy/`
**Purpose:** Deployment scripts for services and applications  
**Examples:**
- `deploy-edge-functions.sh`
- `deploy-admin-app.sh`
- `deploy-to-production.sh`

#### `scripts/test/` & `scripts/testing/`
**Purpose:** Test execution and validation scripts  
**Examples:**
- `run-all-tests.sh`
- `run-security-tests.sh`
- `test-ai-agents.sh`

#### `scripts/verify/`
**Purpose:** Verification and validation scripts  
**Examples:**
- `verify-deployment.sh`
- `verify-migrations-before-deploy.sh`
- `verify-webhook-deployment.sh`

#### `scripts/utility/`
**Purpose:** General utility and helper scripts (CONSOLIDATED)  
**Examples:**
- `commit-helper.sh`
- `git-commit-helper.sh`
- `start-vendor-portal.sh`
- `diagnose-*.sh`

#### `scripts/maintenance/`
**Purpose:** Ongoing maintenance and cleanup tasks  
**Examples:**
- Database cleanup scripts
- Cache management
- Log rotation

### Database Operations

#### `scripts/db/` & `scripts/sql/`
**Purpose:** Database scripts, queries, and migrations  
**Examples:**
- SQL files for data manipulation
- Database backup/restore scripts
- Schema validation queries

#### `scripts/migration/`
**Purpose:** Data migration scripts (feature-specific)  
**Examples:**
- Migration from old schema to new
- Data transformation scripts

### Feature-Specific

#### `scripts/gcp/`
**Purpose:** Google Cloud Platform specific scripts  
**Examples:**
- GCP deployment automation
- Cloud Run configurations
- Secret management

#### `scripts/ibimina-migration/`
**Purpose:** Ibimina feature integration scripts  
**Status:** Feature-specific migration

#### `scripts/go-live/`
**Purpose:** Production go-live checklists and scripts  
**Examples:**
- Pre-launch verification
- Post-launch smoke tests

#### `scripts/menu/`
**Purpose:** Menu data management scripts  
**Examples:**
- Menu upload scripts
- Menu data transformation

### Development & Quality

#### `scripts/development/`
**Purpose:** Development environment setup and tools  
**Examples:**
- Local environment setup
- Development database seeding
- Mock data generation

#### `scripts/checks/`
**Purpose:** Pre-commit and pre-push checks  
**Examples:**
- Linting checks
- Type checking
- Format validation

#### `scripts/security/`
**Purpose:** Security scanning and validation  
**Examples:**
- Dependency scanning
- Secret detection
- Security audit scripts

#### `scripts/audit/`
**Purpose:** Codebase and infrastructure audits  
**Examples:**
- Code quality audits
- Dependency audits
- Performance audits

### Specialized

#### `scripts/data/`
**Purpose:** Data import/export and transformation  
**Examples:**
- CSV imports
- JSON data uploads
- Data seeding scripts

#### `scripts/automation/`
**Purpose:** Automated tasks and scheduled jobs  
**Examples:**
- Cron job scripts
- Scheduled maintenance
- Automated backups

#### `scripts/benchmarks/`
**Purpose:** Performance benchmarking scripts  
**Examples:**
- Load testing
- Performance profiling
- Benchmark comparisons

#### `scripts/cleanup/`
**Purpose:** One-time cleanup and refactoring scripts  
**Examples:**
- Code cleanup
- Deprecated code removal
- Database cleanup

#### `scripts/codemod/`
**Purpose:** Code transformation and refactoring  
**Examples:**
- Automated code migrations
- API version upgrades
- Dependency updates

#### `scripts/consolidation/`
**Purpose:** Feature and code consolidation scripts  
**Examples:**
- Merging duplicate code
- Function consolidation
- Service merging

#### `scripts/refactor/`
**Purpose:** Large-scale refactoring scripts  
**Examples:**
- Architecture changes
- Module restructuring
- Dependency reorganization

#### `scripts/uat/`
**Purpose:** User Acceptance Testing scripts  
**Examples:**
- UAT environment setup
- Test data preparation
- UAT smoke tests

#### `scripts/docs/`
**Purpose:** Documentation generation and validation  
**Examples:**
- API doc generation
- README updates
- Doc link checking

#### `scripts/embeddings/`
**Purpose:** AI/ML embedding generation  
**Examples:**
- Vector embedding generation
- Semantic search indexing

#### `scripts/_shared/`
**Purpose:** Shared utilities and common functions  
**Examples:**
- Common bash functions
- Shared constants
- Reusable modules

## 🎯 Naming Conventions

### Script Files
- **Deployment:** `deploy-<service>.sh`
- **Testing:** `test-<feature>.sh`
- **Verification:** `verify-<feature>.sh`
- **Utility:** `<action>-<target>.sh`

### Directories
- Use lowercase
- Use hyphens for multi-word names
- Keep names concise and descriptive
- Avoid redundant prefixes (e.g., don't use `scripts-` prefix)

## ✅ Best Practices

### When Adding New Scripts

1. **Determine Category**
   - Is it deployment-related? → `scripts/deploy/`
   - Is it a test? → `scripts/test/` or `scripts/testing/`
   - Is it a verification? → `scripts/verify/`
   - Is it feature-specific? → Create feature directory if needed
   - General utility? → `scripts/utility/`

2. **Make Executable**
   ```bash
   chmod +x scripts/category/your-script.sh
   ```

3. **Add Header Comment**
   ```bash
   #!/usr/bin/env bash
   # Purpose: Brief description
   # Usage: ./your-script.sh [args]
   # Author: Your Name
   # Date: YYYY-MM-DD
   ```

4. **Use Shared Functions**
   - Source from `scripts/_shared/` when available
   - Don't duplicate common functionality

5. **Document Dependencies**
   - List required tools (jq, curl, etc.)
   - Note required environment variables
   - Specify minimum versions if applicable

### Script Organization Guidelines

- ✅ **DO:** Group related scripts in subdirectories
- ✅ **DO:** Use descriptive names
- ✅ **DO:** Keep scripts focused and single-purpose
- ✅ **DO:** Document script purpose and usage
- ❌ **DON'T:** Put scripts in repository root
- ❌ **DON'T:** Create deeply nested subdirectories
- ❌ **DON'T:** Mix unrelated scripts in same directory
- ❌ **DON'T:** Use ambiguous names

## 🔧 Maintenance

### Regular Cleanup
- **Quarterly:** Review scripts for obsolete or duplicate code
- **After Major Features:** Archive feature-specific migration scripts
- **Before Releases:** Verify all deployment scripts are up to date

### Archiving Old Scripts
Move to `.archive/scripts/` with date:
```bash
mkdir -p .archive/scripts/YYYY-MM/
mv scripts/category/old-script.sh .archive/scripts/YYYY-MM/
```

### Duplicate Detection
```bash
# Find potential duplicates
find scripts/ -type f -name "*.sh" -exec basename {} \; | sort | uniq -d
```

## 📚 Related Documentation

- [REPOSITORY_CLEANUP_COMPLETED.md](./REPOSITORY_CLEANUP_COMPLETED.md) - Cleanup completion report
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Deployment procedures
- [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md) - Development setup

## 🆘 Getting Help

If unsure where to place a script:
1. Check existing scripts for similar functionality
2. Review this guide's category descriptions
3. Ask in team chat or create a GitHub discussion
4. Default to `scripts/utility/` and refactor later if needed

---

**Note:** This structure has been refined over time. When in doubt, maintain consistency with existing organization.
