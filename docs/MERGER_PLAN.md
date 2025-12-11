# Ibimina → EasyMO Merger Plan

This document outlines the plan for merging the Ibimina repository into EasyMO to create a unified
platform.

## Overview

**Target Architecture**: Single unified EasyMO platform with:

- admin-app: Single unified admin panel
- vendor-portal: Full SACCO/MFI vendor management (from Ibimina)
- client-pwa: End user PWA
- bar-manager-production: Bar/restaurant management
- services/\*: 12+ microservices
- packages/\*: Shared packages

## Current State

### EasyMO (This Repository)

| Component               | Status                            |
| ----------------------- | --------------------------------- |
| admin-app/              | ✅ Production                     |
| vendor-portal/          | 🔴 Skeleton - needs Ibimina merge |
| client-pwa/             | ✅ In workspace                   |
| bar-manager-production/ | ✅ Production (standalone)        |
| services/\*             | ✅ 12+ microservices              |
| packages/\*             | ✅ Shared packages                |

### Ibimina (To Be Merged)

| Component                  | What It Has                                     |
| -------------------------- | ----------------------------------------------- |
| apps/pwa/staff-admin/      | Full SACCO admin console (Next.js 15, React 19) |
| apps/desktop/staff-admin/  | Desktop version (Tauri)                         |
| packages/admin-core/       | Core admin logic                                |
| packages/ui/               | UI components                                   |
| packages/lib/              | Shared utilities                                |
| packages/locales/          | i18n (Kinyarwanda, French, English)             |
| packages/supabase-schemas/ | Database schemas                                |
| packages/config/           | Configuration                                   |
| packages/flags/            | Feature flags                                   |
| supabase/                  | Migrations & Edge Functions                     |

## Merger Phases

### Phase 1: Package Merger ✅ (Prepared)

The following packages have been created as stubs in EasyMO, ready to receive Ibimina content:

```bash
# Package mapping (ibimina → easymo)
packages/admin-core     → packages/vendor-admin-core  ✅ Created
packages/ui             → packages/ui (merge)
packages/lib            → packages/commons (merge)
packages/locales        → packages/locales            ✅ Created
packages/supabase-schemas → packages/supabase-schemas ✅ Created
packages/config         → merge into root config/
packages/flags          → packages/flags              ✅ Created
```

### Phase 2: App Merger (Manual)

Replace vendor-portal skeleton with Ibimina's staff-admin:

```bash
# Backup current skeleton
mv vendor-portal vendor-portal.skeleton.bak

# Copy Ibimina's staff-admin
cp -r ibimina/apps/pwa/staff-admin vendor-portal

# Update package.json name to @easymo/vendor-portal
# Update imports to use @easymo/* packages
# Update supabase client configuration
```

### Phase 3: Desktop App (Optional)

Add vendor desktop app:

```bash
# Copy Ibimina's desktop app
cp -r ibimina/apps/desktop/staff-admin vendor-desktop

# Update package.json name to @easymo/vendor-desktop
# Update workspace references
```

### Phase 4: Supabase Merger (Careful!)

Merge database migrations:

```bash
# 1. Compare existing migrations
ls supabase/migrations/
ls ibimina/supabase/migrations/

# 2. Identify new migrations needed
# 3. Copy new migrations with proper timestamps
# 4. Ensure BEGIN/COMMIT wrappers (per GROUND_RULES.md)
# 5. Test on staging first
```

### Phase 5: Cleanup

Archive deprecated apps:

```bash
# Already done ✅
mv bar-manager-app .archive/deprecated-apps/
```

## Dependency Changes

After merger, update package dependencies:

```diff
// vendor-portal/package.json
{
  "dependencies": {
-   "@easymo/sacco-core": "workspace:*",
+   "@easymo/vendor-admin-core": "workspace:*",
+   "@easymo/locales": "workspace:*",
+   "@easymo/flags": "workspace:*",
+   "@easymo/supabase-schemas": "workspace:*",
  }
}
```

## Updated pnpm-workspace.yaml

Already updated to support the merger:

```yaml
packages:
  - packages/*
  - services/*
  - admin-app
  - ai
  - client-pwa
  - vendor-portal # SACCO/MFI vendor management
  # - vendor-desktop       # Uncomment after Phase 3
```

## Admin-App Enhancement

After merger, admin-app needs these new modules:

| Module             | Purpose                             | Source   |
| ------------------ | ----------------------------------- | -------- |
| Vendor/SACCO Admin | Member mgmt, groups, reconciliation | Ibimina  |
| MomoTerminal Admin | Device mgmt, SMS webhooks, health   | To Build |

### MomoTerminal Admin Module

Create new admin module at `admin-app/app/(dashboard)/momo-terminal/`:

- Device management
- SMS webhook configuration
- Device health monitoring
- Transaction logs

## Build & Test Commands

```bash
# After merger, verify:

# 1. Install dependencies
pnpm install

# 2. Build shared packages
pnpm build:deps

# 3. Build vendor portal
pnpm --filter @easymo/vendor-portal build

# 4. Run tests
pnpm test

# 5. Type check
pnpm type-check
```

## Migration Checklist

- [x] Create package stubs (locales, flags, supabase-schemas, vendor-admin-core)
- [x] Archive deprecated bar-manager-app
- [x] Update pnpm-workspace.yaml
- [ ] Copy Ibimina packages content
- [ ] Copy Ibimina vendor-portal (staff-admin) app
- [ ] Merge Supabase migrations
- [ ] Update import paths
- [ ] Test all packages build
- [ ] Test vendor-portal functionality
- [ ] Add MomoTerminal admin module to admin-app

## Notes

1. **Package Names**: All packages use `@easymo/*` namespace
2. **Feature Flags**: All new features must be gated (see `packages/flags/`)
3. **i18n**: Support for en, fr, rw locales (see `packages/locales/`)
4. **Ground Rules**: All code must comply with `docs/GROUND_RULES.md`

---

**Created**: December 9, 2025  
**Status**: Phase 1 Complete (Stubs Created)  
**Next**: Manual merger of Ibimina content
