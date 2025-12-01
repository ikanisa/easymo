# Deprecated Applications

This directory contains application versions that have been superseded by production versions.

## Current Production Apps (DO NOT ARCHIVE)

### Admin Applications
- **admin-app/** - ✅ PRODUCTION - Admin dashboard (Next.js 15, npm-based)
  - Package: `@easymo/admin-app`
  - Last updated: Dec 1, 2025
  - In workspace: YES
  - Status: Active development

### Bar Manager Applications
- **bar-manager-production/** - ✅ PRODUCTION - Bar/restaurant management
  - Package: `bar-manager-production`
  - Standalone app (not in workspace)
  - Status: Production deployment

## Deprecated Apps (Candidates for Archive)

### Admin App V2
- **admin-app-v2/** - ⚠️ DEPRECATED as of Nov 27, 2025
  - Package: `@easymo/admin-v2`
  - Commented out in pnpm-workspace.yaml
  - See: admin-app-v2/DEPRECATED.md
  - **Action**: Archive recommended

### Bar Manager Variants
- **bar-manager-app/** - ⚠️ DUPLICATE
  - Package: `@easymo/bar-manager`
  - Not in workspace (requires lockfile update)
  - Status: Development/testing version
  - **Action**: Archive recommended (keep bar-manager-production)

- **bar-manager-final/** - ⚠️ DUPLICATE
  - Package: `@easymo/admin-app` (NAME CONFLICT!)
  - Not in workspace
  - Status: Staging version
  - **Action**: Archive recommended (keep bar-manager-production)

## Archive Procedure

```bash
# When ready to archive:
mv admin-app-v2 .archive/deprecated-apps/
mv bar-manager-app .archive/deprecated-apps/
mv bar-manager-final .archive/deprecated-apps/

# Update pnpm-workspace.yaml to remove comments about archived apps
```

## Production App Matrix

| App | Directory | Package Name | In Workspace | Status |
|-----|-----------|--------------|--------------|--------|
| Admin Dashboard | admin-app | @easymo/admin-app | ✅ Yes | 🟢 Production |
| Admin V2 | admin-app-v2 | @easymo/admin-v2 | ❌ Deprecated | 🔴 Archive |
| Bar Manager Dev | bar-manager-app | @easymo/bar-manager | ❌ No | 🟡 Development |
| Bar Manager Staging | bar-manager-final | @easymo/admin-app | ❌ No | 🟡 Staging |
| Bar Manager Prod | bar-manager-production | bar-manager-production | ❌ Standalone | 🟢 Production |

## Notes

- **admin-app** and **bar-manager-production** are the ONLY production versions
- bar-manager-final has a package name conflict (uses @easymo/admin-app)
- bar-manager-app is not integrated into the workspace
- All variants appear to be iterations toward bar-manager-production

---

**Last Updated**: December 1, 2025  
**Purpose**: Clarify production vs deprecated app versions
