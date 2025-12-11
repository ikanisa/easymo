# Ibimina Migration - Quick Reference

## ✅ What Was Done

**Merged ibimina SACCO platform into easymo:**

1. **Admin routes** → `admin-app/app/ibimina-admin/`
2. **Staff portal** → `vendor-portal/` (renamed from ibimina staff-admin)
3. **Shared packages** → 7 new `@easymo/ibimina-*` packages

## 🚀 Quick Start

### Build & Run

```bash
# Install
pnpm install

# Build ibimina packages
pnpm --filter "@easymo/ibimina-*" build

# Dev: Vendor Portal (SACCO staff operations)
pnpm --filter @easymo/vendor-portal dev  # http://localhost:3100

# Dev: Admin (includes ibimina admin routes)
pnpm --filter @easymo/admin-app dev      # http://localhost:3000
```

### Admin Routes (in admin-app)

Access at `http://localhost:3000/ibimina-admin/`:

- `/ibimina-admin/countries` - Country management
- `/ibimina-admin/partners` - Partner orgs
- `/ibimina-admin/telcos` - Telecom operators
- `/ibimina-admin/invites` - Staff invites

### Vendor Portal Routes

Access at `http://localhost:3100/`:

- `/staff` - SACCO operations dashboard
- `/staff/onboarding` - Member onboarding
- `/staff/allocations` - Share allocations
- `/staff/exceptions` - Exception handling
- `/member` - Member self-service portal

## 📦 New Packages

All in `packages/ibimina-*`:

1. `ibimina-config` - Env configuration
2. `ibimina-flags` - Feature flags
3. `ibimina-lib` - Utilities
4. `ibimina-locales` - i18n (Kinyarwanda, French, English)
5. `ibimina-supabase-schemas` - DB types
6. `ibimina-ui` - Shared components
7. `ibimina-admin-core` - Admin logic

## 🔧 Configuration

### Environment Variables

**Vendor Portal** (`.env`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # Server-only

# Feature flags
FEATURE_VENDOR_PORTAL=true
FEATURE_IBIMINA_ADMIN=true
```

## 📁 Directory Structure

```
easymo/
├── admin-app/app/ibimina-admin/    # NEW: Admin routes
├── vendor-portal/                  # NEW: Staff SACCO portal
└── packages/
    ├── ibimina-config/             # NEW
    ├── ibimina-flags/              # NEW
    ├── ibimina-lib/                # NEW
    ├── ibimina-locales/            # NEW
    ├── ibimina-supabase-schemas/   # NEW
    ├── ibimina-ui/                 # NEW
    └── ibimina-admin-core/         # NEW
```

## ⚠️ Next Steps

1. **Database**: Merge Supabase migrations
2. **Edge Functions**: Copy ibimina functions
3. **Testing**: Run full test suite
4. **Observability**: Add structured logging (GROUND_RULES)

## 📚 Full Documentation

See `IBIMINA_MIGRATION_COMPLETE.md` for complete details.

---

**Status**: Phase 1-4 Complete ✅ | Phase 5-6 Pending 🔄
