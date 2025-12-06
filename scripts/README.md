# EasyMO Scripts Directory

This directory contains various automation scripts for the EasyMO platform.

## 📱 macOS Code Signing Scripts

**Purpose:** Sign macOS desktop apps (Admin Panel + Client/Staff Portal) for internal distribution.

### Core Signing Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `list_identities.sh` | List available code-signing certificates | `./scripts/list_identities.sh` |
| `check_certificate.sh` | Verify certificate setup before signing | `./scripts/check_certificate.sh` |
| `sign_app.sh` | Sign a single .app bundle with verification | `./scripts/sign_app.sh <path> <identity>` |
| **`sign_all_apps.sh`** | **Sign both apps at once (main entry)** | **`./scripts/sign_all_apps.sh`** |
| `verify_apps.sh` | Verify signatures after signing | `./scripts/verify_apps.sh` |
| `test_signing_workflow.sh` | Run end-to-end test suite | `./scripts/test_signing_workflow.sh` |

### Quick Start

```bash
# 1. First time setup
./scripts/check_certificate.sh
./scripts/test_signing_workflow.sh

# 2. Sign both apps
./scripts/sign_all_apps.sh

# 3. Verify signatures
./scripts/verify_apps.sh
```

### Documentation

- **Quick Start:** [../SIGNING_QUICK_START.md](../SIGNING_QUICK_START.md)
- **Complete Guide:** [../docs/internal_mac_signing.md](../docs/internal_mac_signing.md)
- **CI/CD Setup:** [../docs/github_actions_signing.md](../docs/github_actions_signing.md)
- **Master Index:** [../docs/SIGNING_REFERENCE.md](../docs/SIGNING_REFERENCE.md)

---

## 🚀 Deployment Scripts

| Script | Purpose |
|--------|---------|
| `deploy-agents.sh` | Deploy AI agents to production |
| `deploy-ai-agents.sh` | Deploy AI agent configurations |
| `complete-deployment.sh` | Complete deployment workflow |
| `pre-deploy-check.sh` | Pre-deployment validation |
| `post-deploy-smoke.sh` | Post-deployment smoke tests |

---

## 🧪 Testing & Validation Scripts

| Script | Purpose |
|--------|---------|
| `test-agents.sh` | Test AI agent functionality |
| `test-ai-agents.sh` | Test AI agent integrations |
| `verify-ai-agents.sh` | Verify AI agent deployments |
| `verify-deployment.sh` | Verify deployment success |
| `test-business-directory-broker.sh` | Test business directory features |
| `test-distance-calculation.sh` | Test geolocation features |
| `validate-agent-db-architecture.sh` | Validate agent database schema |
| `validate-agent-fallbacks.sh` | Validate agent fallback logic |

---

## 📊 Analysis & Monitoring Scripts

| Script | Purpose |
|--------|---------|
| `analyze-phase3.sh` | Analyze Phase 3 implementation |
| `monitor-agent-config-loading.sh` | Monitor agent configuration loading |
| `check-wa-webhook.sh` | Check WhatsApp webhook status |
| `audit-wa-templates.sh` | Audit WhatsApp message templates |

---

## 🗺️ Data Extraction & Import Scripts

### Google Maps Business Scraper

**Purpose:** Extract business information from Google Maps search results and sync to Supabase with duplicate detection.

#### Setup

```bash
# Install Python dependencies
pip install -r scripts/requirements-scraper.txt

# Install Playwright browser
playwright install chromium

# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
# OR use direct PostgreSQL connection
export DATABASE_URL="postgresql://user:pass@host:port/database"
```

#### Usage Examples

```bash
# Basic usage - extract pharmacies
python scripts/google_maps_scraper.py "https://www.google.com/maps/search/pharmacies/@-1.9857408,30.1006848,15z"

# Dry run - preview without inserting to database
python scripts/google_maps_scraper.py --dry-run "https://maps.google.com/search/pharmacies/@-1.9,30.1,15z"

# Custom category and limit
python scripts/google_maps_scraper.py --category restaurant --limit 20 "https://maps.google.com/..."

# Visible browser mode (for debugging)
python scripts/google_maps_scraper.py --no-headless "https://maps.google.com/..."
```

#### Features

- **Data Extraction:** Scrapes name, address, phone, lat/lng, rating, website, and opening hours
- **Duplicate Detection:** Checks for duplicates by name (case-insensitive), location proximity (~100m), or phone number
- **Update Existing:** Updates existing records instead of creating duplicates
- **Dry Run Mode:** Preview businesses before inserting to database
- **Progress Tracking:** Detailed logging of processing and results
- **Error Handling:** Graceful handling of network issues and rate limiting

#### Duplicate Detection Logic

The script identifies duplicates using any of these criteria:
1. **Name match:** Case-insensitive exact name match
2. **Location proximity:** Within ~100 meters using PostGIS spatial queries
3. **Phone match:** Matching phone number (normalized)

When a duplicate is found, the existing record is updated with new information instead of creating a new entry.

#### Output

The script provides detailed progress output:
```
📍 Step 1: Scraping Google Maps...
✅ Found 15 businesses

💾 Step 2: Syncing to database...
[1/15] Processing: Pharmacy ABC
  ⚠️  Duplicate found (by name): Pharmacy ABC
  ✅ Updated existing business
[2/15] Processing: Pharmacy XYZ
  ✅ Inserted new business (ID: 123...)

Summary
================================================================================
Total businesses found: 15
✅ New businesses added: 8
🔄 Existing businesses updated: 5
❌ Errors: 2
```

### Other Data Scripts

| Script | Purpose |
|--------|---------|
| `extract_coordinates.py` | Extract coordinates from Google Maps URLs in business table |
| `extract_coordinates_from_maps.py` | Extract coordinates using geocoding API |
| `extract_coordinates_no_api.py` | Extract coordinates without API |
| `geocode-data.sh` | Geocode location data |
| `import-business-directory.mjs` | Import business directory data |

---

## 🗄️ Database & Migration Scripts

| Script | Purpose |
|--------|---------|
| `supabase-backup-restore.sh` | Backup and restore Supabase database |
| `deploy-consolidated-migrations.sh` | Deploy consolidated migrations |
| `deploy-distance-fix.sh` | Deploy distance calculation fixes |
| `create-business-directory-table.sh` | Create business directory table |
| `cleanup-migrations.sh` | Clean up migration files |
| `check-migration-hygiene.sh` | Verify migration file hygiene |
| `verify-mobility-schema.sh` | Verify mobility database schema |
| `prisma-baseline-supabase.sh` | Baseline Prisma schema with Supabase |

---

## 📦 WhatsApp & Webhook Scripts

| Script | Purpose |
|--------|---------|
| `export-wa-realtime-env.sh` | Export WhatsApp realtime environment variables |
| `wa-webhook-split-phase*.sh` | WhatsApp webhook splitting (Phase 1-5) |
| `validate-webhook-enhancement.sh` | Validate webhook enhancements |

---

## 🔧 Build & Infrastructure Scripts

| Script | Purpose |
|--------|---------|
| `build-desktop.sh` | Build desktop applications |
| `archive-docs.sh` | Archive documentation files |
| `setup-ai-agents.sh` | Set up AI agent infrastructure |
| `setup-supabase-config.sh` | Set up Supabase configuration |
| `check-deno-lockfiles.sh` | Verify Deno lockfile integrity |

---

## 🌐 Server & Proxy Scripts

| Script | Purpose |
|--------|---------|
| `caddy_up.sh` | Start Caddy reverse proxy |
| `caddy_down.sh` | Stop Caddy reverse proxy |
| `caddy_bg.sh` | Run Caddy in background |
| `caddy_common.sh` | Common Caddy utilities |
| `run-supabase-mcp-server.sh` | Run Supabase MCP server |

---

## 🎯 Phase-Specific Scripts

| Script | Purpose |
|--------|---------|
| `phase0-blockers.sh` | Phase 0 blocker checks |
| `phase3-index.sh` | Phase 3 index |
| `phase3-quick-start.sh` | Phase 3 quick start |
| `phase3-summary.sh` | Phase 3 summary |
| `phase3-tasks.sh` | Phase 3 task list |

---

## 🛠️ Utility Scripts

| Script | Purpose |
|--------|---------|
| `seed-remote.sh` | Seed remote database |
| `test-functions.sh` | Test Supabase Edge Functions |
| `smoke-brokerai.sh` | Smoke test for broker AI |
| `remove_ke_ug.sh` | Remove deprecated country codes (KE, UG) |
| `geocode-data.sh` | Geocode location data |

---

## 💡 Best Practices

### Before Running Scripts

1. **Check requirements:** Most scripts require specific environment variables
2. **Read script headers:** Each script has usage instructions in comments
3. **Test in dev first:** Always test scripts in development before production
4. **Backup data:** Run backups before database-altering scripts

### Script Conventions

- ✅ **Executable:** All scripts should have `chmod +x` permissions
- ✅ **Exit codes:** 0 = success, non-zero = failure
- ✅ **Idempotent:** Scripts should be safe to run multiple times
- ✅ **Documented:** Headers explain purpose, usage, and requirements

---

## 🆘 Getting Help

- **General scripts:** See main [README.md](../README.md)
- **Code signing:** See [SIGNING_QUICK_START.md](../SIGNING_QUICK_START.md)
- **Deployment:** See [docs/deployment/](../docs/deployment/)
- **Testing:** See [docs/testing/](../docs/testing/)

---

**Last updated:** 2025-12-02  
**Total scripts:** 60+  
**Categories:** 10
