#!/bin/bash
# PHASE 2: Repository Organization
# Organize documentation, scripts, and migrations properly

set -e

echo "🗂️  Starting Phase 2: Repository Organization"
echo "=============================================="

# 2.1 Create Documentation Structure
echo ""
echo "📚 Step 2.1: Creating documentation structure..."

mkdir -p docs/{architecture,deployment,development,features,archive}

echo "  ✓ Created docs directories"

# 2.2 Organize Documentation Files
echo ""
echo "📚 Step 2.2: Organizing markdown files..."

# Move AI Agent docs
if ls AI_AGENT*.md 1> /dev/null 2>&1; then
  mv AI_AGENT*.md docs/archive/ 2>/dev/null || true
  echo "  ✓ Moved AI_AGENT docs to archive"
fi

# Move Waiter AI docs
if ls WAITER_AI*.md 1> /dev/null 2>&1; then
  mv WAITER_AI*.md docs/archive/ 2>/dev/null || true
  echo "  ✓ Moved WAITER_AI docs to archive"
fi

# Move Deployment docs
if ls DEPLOYMENT*.md 1> /dev/null 2>&1; then
  mv DEPLOYMENT*.md docs/archive/ 2>/dev/null || true
  echo "  ✓ Moved DEPLOYMENT docs to archive"
fi

# Move WhatsApp webhook docs
if ls WA_WEBHOOK*.md 1> /dev/null 2>&1; then
  mv WA_WEBHOOK*.md docs/archive/ 2>/dev/null || true
  echo "  ✓ Moved WA_WEBHOOK docs to archive"
fi

# Move other status/summary docs
if ls *_STATUS.md *_SUMMARY.md *_COMPLETE.md 1> /dev/null 2>&1; then
  mv *_STATUS.md *_SUMMARY.md *_COMPLETE.md docs/archive/ 2>/dev/null || true
  echo "  ✓ Moved status/summary docs to archive"
fi

# Keep important docs in root
KEEP_DOCS="README.md CONTRIBUTING.md CHANGELOG.md LOGIN_INTERFACE_REVIEW.md COMPREHENSIVE_CLEANUP_PLAN.md"
for doc in $KEEP_DOCS; do
  if [ ! -f "$doc" ] && [ -f "docs/archive/$doc" ]; then
    mv "docs/archive/$doc" .
  fi
done

echo "  ✓ Organized $(find docs/archive -name '*.md' | wc -l) markdown files"

# 2.3 Organize Scripts
echo ""
echo "🔧 Step 2.3: Organizing scripts..."

mkdir -p scripts/{development,deployment,database,testing,utilities}

# Move test scripts
if ls test-*.sh 1> /dev/null 2>&1; then
  mv test-*.sh scripts/testing/ 2>/dev/null || true
  echo "  ✓ Moved test scripts"
fi

# Move deployment scripts
if ls deploy-*.sh 1> /dev/null 2>&1; then
  mv deploy-*.sh scripts/deployment/ 2>/dev/null || true
  echo "  ✓ Moved deployment scripts"
fi

# Move demo scripts
if ls demo-*.sh 1> /dev/null 2>&1; then
  mv demo-*.sh scripts/development/ 2>/dev/null || true
  echo "  ✓ Moved demo scripts"
fi

# Move check scripts
if ls check-*.sh verify-*.sh 1> /dev/null 2>&1; then
  mv check-*.sh verify-*.sh scripts/utilities/ 2>/dev/null || true
  echo "  ✓ Moved check/verify scripts"
fi

# Move enable scripts
if ls enable-*.sh 1> /dev/null 2>&1; then
  mv enable-*.sh scripts/utilities/ 2>/dev/null || true
  echo "  ✓ Moved enable scripts"
fi

# Move execute/restore scripts
if ls execute_*.sh restore_*.sh 1> /dev/null 2>&1; then
  mv execute_*.sh restore_*.sh scripts/database/ 2>/dev/null || true
  echo "  ✓ Moved database scripts"
fi

# Make all scripts executable
find scripts -name "*.sh" -exec chmod +x {} \;
echo "  ✓ Made scripts executable"

# 2.4 Organize SQL Files
echo ""
echo "🗄️  Step 2.4: Organizing SQL files..."

mkdir -p migrations/{manual,archive}

# Move SQL files to migrations
if ls *.sql 1> /dev/null 2>&1; then
  for file in *.sql; do
    if [[ "$file" == "latest_schema.sql" ]]; then
      mv "$file" migrations/
    else
      mv "$file" migrations/manual/
    fi
  done
  echo "  ✓ Moved SQL files to migrations/"
fi

# 2.5 Create README files
echo ""
echo "📝 Step 2.5: Creating README files..."

# docs/README.md
cat > docs/README.md << 'EOF'
# EasyMO Documentation

## Directory Structure

- **architecture/** - System architecture and design docs
- **deployment/** - Deployment guides and procedures
- **development/** - Development setup and guidelines
- **features/** - Feature documentation
- **archive/** - Historical documentation (for reference)

## Quick Links

- [Main README](../README.md)
- [Setup Guide](development/DEV_SETUP.md)
- [Deployment Guide](deployment/DEPLOYMENT_GUIDE.md)
- [Contributing Guide](../CONTRIBUTING.md)

## Documentation Standards

1. Use clear, descriptive titles
2. Include table of contents for long documents
3. Keep docs up to date with code changes
4. Archive outdated documentation (don't delete)
5. Link related documents

## Need Help?

- Check the [architecture docs](architecture/) for system overview
- See [development docs](development/) for setup help
- Review [feature docs](features/) for specific features
EOF

# scripts/README.md
cat > scripts/README.md << 'EOF'
# Scripts Directory

## Directory Structure

- **development/** - Development and testing scripts
- **deployment/** - Deployment and release scripts
- **database/** - Database migration and management
- **testing/** - Automated testing scripts
- **utilities/** - General utility scripts
- **cleanup/** - Cleanup and maintenance scripts

## Usage Guidelines

1. All scripts should have clear comments
2. Use `set -e` for error handling
3. Validate inputs before executing
4. Log actions for debugging
5. Provide usage examples

## Common Scripts

### Development
- `development/seed-data.sh` - Seed test data

### Deployment
- `deployment/deploy-production.sh` - Deploy to production
- `deployment/deploy-staging.sh` - Deploy to staging

### Testing
- `testing/run-all-tests.sh` - Run all test suites

### Utilities
- `utilities/check-health.sh` - Health check
- `utilities/verify-env.sh` - Verify environment setup
EOF

# migrations/README.md
cat > migrations/README.md << 'EOF'
# Database Migrations

## Directory Structure

- **manual/** - Manual SQL scripts (one-time migrations)
- **archive/** - Completed/historical migrations
- **latest_schema.sql** - Current schema snapshot

## Migration Strategy

1. Use Supabase migrations for schema changes
2. Manual scripts for data migrations
3. Always test in development first
4. Create backup before applying
5. Document each migration

## Applying Migrations

### Supabase Migrations
```bash
supabase db push
```

### Manual SQL Scripts
```bash
psql -f migrations/manual/script.sql
```

## Best Practices

1. Migrations should be idempotent
2. Include rollback procedures
3. Test with sample data
4. Document breaking changes
5. Keep migrations small and focused
EOF

echo "  ✓ Created README files"

# 2.6 Summary
echo ""
echo "📊 Summary:"
echo "  - Documentation files organized: $(find docs -name '*.md' | wc -l) files"
echo "  - Scripts organized: $(find scripts -name '*.sh' | wc -l) scripts"
echo "  - Migrations organized: $(find migrations -name '*.sql' | wc -l) files"
echo ""
echo "✅ Phase 2 Complete!"
echo "===================="
echo ""
echo "Next steps:"
echo "1. Review organized files: ls -R docs/ scripts/ migrations/"
echo "2. Commit changes: git add . && git commit -m 'Phase 2: Organize repository structure'"
echo "3. Proceed to Phase 3: bash scripts/cleanup/phase3-security.sh"
