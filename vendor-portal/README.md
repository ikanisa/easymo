# Vendor Portal (@easymo/vendor-portal)

Management portal for SACCOs, MFIs, and other financial institutions.

## Features

- **Member Management**: Track SACCO members and their accounts
- **Payment Processing**: SMS parsing integration for MoMo payments
- **Group Savings (Ikimina)**: Manage savings groups
- **Reconciliation**: Match SMS payments to member accounts
- **Reporting**: Financial reports and analytics

## Getting Started

```bash
cd vendor-portal
pnpm install
pnpm dev
```

Visit http://localhost:3003

## SMS Payment Integration

This portal integrates with EasyMO's SMS parsing infrastructure to automatically:
1. Receive MoMo SMS via `momo-sms-webhook`
2. Match transactions to SACCO members by phone number
3. Create payment records in `app.payments`
4. Update member balances

## Tech Stack

- Next.js 15 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Edge Functions)
- @easymo/sacco-core (shared SACCO types and utilities)
- @easymo/sms-parser (SMS parsing for MoMo transactions)

## Directory Structure

```
vendor-portal/
├── app/                      # Next.js app directory
│   ├── (auth)/              # Authentication pages
│   │   └── login/
│   ├── (dashboard)/         # Dashboard pages
│   │   ├── members/
│   │   ├── payments/
│   │   ├── groups/
│   │   └── settings/
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/
│   ├── layout/              # Layout components
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── MobileNav.tsx
│   └── dashboard/
│       └── StatsCard.tsx
├── lib/
│   ├── supabase/            # Supabase clients
│   │   ├── client.ts
│   │   └── server.ts
│   └── utils.ts             # Utility functions
└── types/
    └── index.ts             # TypeScript types
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Build

```bash
pnpm build
```

## Deploy

The vendor portal can be deployed alongside other EasyMO apps:

```bash
# From monorepo root
pnpm run build:vendor-portal
```
