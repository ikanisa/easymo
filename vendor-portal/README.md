# Vendor Portal - SACCO/MFI Management System

Next.js 15 application for managing SACCOs, MFIs, and financial institutions integrated with the Ibimina platform.

## Status: Phase 1 Foundation ✅

**Created**: 2025-12-09  
**Port**: 3003  
**Framework**: Next.js 15 + React 19 + TypeScript

---

## Phase 1 Complete (Foundation)

### ✅ Configuration Files
- `package.json` - Dependencies and scripts
- `next.config.mjs` - Next.js configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS with SACCO brand colors
- `postcss.config.mjs` - PostCSS configuration
- `.env.example` - Environment variables template
- `.gitignore` - Git ignore rules

### ✅ Shared Packages
- `@easymo/sacco-core` - Business logic and types
- `@easymo/sms-parser` - SMS parsing for MoMo/Airtel

---

## Phase 2 Pending (App Structure)

### 📋 To Create

#### App Directory (`app/`)
- [ ] `layout.tsx` - Root layout
- [ ] `page.tsx` - Home (redirect to login/dashboard)
- [ ] `globals.css` - Global styles
- [ ] `loading.tsx` - Loading state
- [ ] `error.tsx` - Error boundary
- [ ] `not-found.tsx` - 404 page

#### Auth Pages (`app/(auth)/`)
- [ ] `layout.tsx` - Auth layout (split screen)
- [ ] `login/page.tsx` - Login form
- [ ] `forgot-password/page.tsx` - Password reset

#### Dashboard Pages (`app/(dashboard)/`)
- [ ] `layout.tsx` - Dashboard layout (sidebar + header)
- [ ] `page.tsx` - Dashboard home
- [ ] `members/page.tsx` - Members list
- [ ] `payments/page.tsx` - Payments (matched/unmatched)
- [ ] `groups/page.tsx` - Ikimina groups
- [ ] `settings/page.tsx` - Settings (profile, webhook, notifications)

#### UI Components (`components/ui/`)
- [ ] `button.tsx` - Button component
- [ ] `card.tsx` - Card component
- [ ] `input.tsx` - Input component
- [ ] `badge.tsx` - Badge component
- [ ] `table.tsx` - Table component
- [ ] `skeleton.tsx` - Skeleton loader
- [ ] `tabs.tsx` - Tabs component

#### Layout Components (`components/layout/`)
- [ ] `sidebar.tsx` - Navigation sidebar
- [ ] `header.tsx` - Top header
- [ ] `mobile-nav.tsx` - Mobile navigation

#### Dashboard Components (`components/dashboard/`)
- [ ] `stats-card.tsx` - Statistics card
- [ ] `recent-activity.tsx` - Recent activity list

#### Lib (`lib/`)
- [ ] `supabase/client.ts` - Supabase client-side
- [ ] `supabase/server.ts` - Supabase server-side
- [ ] `supabase/middleware.ts` - Auth middleware
- [ ] `utils.ts` - Utility functions (cn, etc.)
- [ ] `constants.ts` - App constants

---

## Quick Start

### Prerequisites
1. Node.js 18+
2. pnpm installed
3. Supabase project with `app.*` schema (from Phase 1-3 migrations)

### Install Dependencies

From monorepo root:
```bash
cd /Users/jeanbosco/workspace/easymo
pnpm install
```

### Build Shared Packages

```bash
pnpm --filter @easymo/sacco-core build
pnpm --filter @easymo/sms-parser build
```

### Configure Environment

```bash
cd vendor-portal
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### Run Development Server

```bash
pnpm --filter @easymo/vendor-portal dev
```

Visit: http://localhost:3003

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│          Vendor Portal (Next.js 15)             │
│              Port: 3003                         │
├─────────────────────────────────────────────────┤
│  Auth (Supabase SSR)                            │
│  ├── Login                                      │
│  ├── Password Reset                             │
│  └── Session Management                         │
├─────────────────────────────────────────────────┤
│  Dashboard                                      │
│  ├── Stats Cards                                │
│  ├── Recent Activity                            │
│  └── Quick Actions                              │
├─────────────────────────────────────────────────┤
│  Members Management                             │
│  ├── List (search, filter)                     │
│  ├── Add Member                                 │
│  └── View Details                               │
├─────────────────────────────────────────────────┤
│  Payments                                       │
│  ├── Matched (auto-linked)                     │
│  ├── Unmatched (manual review)                 │
│  └── Match to Member                            │
├─────────────────────────────────────────────────┤
│  Groups (Ikimina)                               │
│  ├── List                                       │
│  ├── Create Group                               │
│  └── Group Details                              │
├─────────────────────────────────────────────────┤
│  Settings                                       │
│  ├── SACCO Profile                              │
│  ├── SMS Webhook                                │
│  └── Notifications                              │
└─────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────┐
│        Shared Packages                          │
├─────────────────────────────────────────────────┤
│  @easymo/sacco-core                             │
│  ├── Types (Zod schemas)                        │
│  ├── Utils (phone, currency, reference)        │
│  └── Constants (Rwanda data)                    │
├─────────────────────────────────────────────────┤
│  @easymo/sms-parser                             │
│  ├── MTN Parser                                 │
│  ├── Airtel Parser                              │
│  └── Base Parser                                │
└─────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────┐
│        Supabase (Backend)                       │
├─────────────────────────────────────────────────┤
│  Database (app.* schema)                        │
│  ├── saccos                                     │
│  ├── members (PII protected)                    │
│  ├── payments                                   │
│  ├── accounts                                   │
│  ├── ikimina (groups)                           │
│  └── ledger_entries                             │
├─────────────────────────────────────────────────┤
│  Auth (Row Level Security)                      │
│  ├── User sessions                              │
│  ├── RLS policies                               │
│  └── SACCO-scoped access                        │
└─────────────────────────────────────────────────┘
```

---

## Database Schema

Uses existing `app.*` schema from Phase 1-3 migrations:

```sql
-- Already exists in Supabase
app.saccos          -- SACCO registry
app.ikimina         -- Savings groups
app.members         -- Members (PII encrypted)
app.accounts        -- Member accounts
app.payments        -- Payment transactions
app.ledger_entries  -- Ledger/journal
```

**No new migrations required** - vendor portal connects to existing schema.

---

## Features

### Completed (Phase 1)
- ✅ Project configuration
- ✅ TypeScript setup
- ✅ Tailwind CSS with SACCO branding
- ✅ Shared packages (types, utils, SMS parsing)
- ✅ Package documentation

### Pending (Phase 2+)
- ⏳ Authentication (Supabase SSR)
- ⏳ Dashboard UI
- ⏳ Member management
- ⏳ Payment reconciliation
- ⏳ Group (Ikimina) management
- ⏳ SMS webhook configuration
- ⏳ Real-time data fetching

---

## Development Commands

```bash
# Vendor portal
pnpm --filter @easymo/vendor-portal dev      # Start dev server
pnpm --filter @easymo/vendor-portal build    # Production build
pnpm --filter @easymo/vendor-portal lint     # Lint code
pnpm --filter @easymo/vendor-portal type-check  # Type check

# Shared packages
pnpm --filter @easymo/sacco-core build       # Build sacco-core
pnpm --filter @easymo/sms-parser build       # Build sms-parser

# All at once
pnpm build                                    # Build all packages
```

---

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3003
NEXT_PUBLIC_APP_NAME=Vendor Portal
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
```

---

## Next Steps

1. **Install Dependencies**
   ```bash
   pnpm install
   pnpm --filter @easymo/sacco-core build
   pnpm --filter @easymo/sms-parser build
   ```

2. **Create Remaining Pages**
   - Use prompt files in this README
   - Create auth pages
   - Create dashboard layout
   - Create data pages (members, payments, groups)

3. **Connect to Supabase**
   - Configure environment variables
   - Set up auth middleware
   - Create Supabase client utilities

4. **Test with Real Data**
   - Use data from Ibimina migration
   - Test payment matching
   - Test member management

---

## Support

For issues or questions:
1. Check package READMEs in `packages/*/README.md`
2. Review implementation in `admin-app/` for patterns
3. See Supabase docs for auth setup

---

**Last Updated**: 2025-12-09  
**Version**: 0.1.0  
**Status**: Phase 1 Complete (Foundation)
