# Deprecated Applications

This directory contains application versions that have been superseded by production versions.

## Current Production Apps (DO NOT ARCHIVE)

### Admin Applications
- **admin-app/** - ✅ PRODUCTION - Admin dashboard (Next.js 15, npm-based)
  - Package: `@easymo/admin-app`
  - Last updated: Dec 9, 2025
  - In workspace: YES
  - Status: Active development

### Bar Manager Applications
- **bar-manager-production/** - ✅ PRODUCTION - Bar/restaurant management
  - Package: `bar-manager-production`
  - Standalone app (not in workspace)
  - Status: Production deployment

### Vendor Portal
- **vendor-portal/** - 🚧 IN DEVELOPMENT - SACCO/MFI vendor management
  - Package: `@easymo/vendor-portal`
  - Last updated: Dec 9, 2025
  - In workspace: YES
  - Status: Pending Ibimina merger

## Archived Apps

### Bar Manager App (Archived Dec 9, 2025)
- **bar-manager-app/** - 🔴 ARCHIVED
  - Package: `@easymo/bar-manager`
  - Was: Not in workspace
  - Reason: Duplicate of bar-manager-production
  - See: ./bar-manager-app/

## Production App Matrix

| App | Directory | Package Name | In Workspace | Status |
|-----|-----------|--------------|--------------|--------|
| Admin Dashboard | admin-app | @easymo/admin-app | ✅ Yes | 🟢 Production |
| Bar Manager Prod | bar-manager-production | bar-manager-production | ❌ Standalone | 🟢 Production |
| Vendor Portal | vendor-portal | @easymo/vendor-portal | ✅ Yes | 🟡 Development |
| Bar Manager App | .archive/deprecated-apps/bar-manager-app | @easymo/bar-manager | ❌ Archived | 🔴 Archived |

## Notes

- **admin-app** and **bar-manager-production** are the production versions
- **vendor-portal** is pending merger with Ibimina repository for full SACCO functionality
- bar-manager-app was archived on Dec 9, 2025 as part of platform consolidation

---

**Last Updated**: December 9, 2025  
**Purpose**: Clarify production vs deprecated app versions
