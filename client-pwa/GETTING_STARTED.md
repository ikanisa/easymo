# Getting Started with EasyMO Client PWA

> **Quick Start Guide** - Get the PWA running in 5 minutes

## 🎯 Overview

The **EasyMO Client PWA** is a production-ready Progressive Web Application for restaurant and bar customers in Rwanda, DRC, Burundi, and Tanzania. Customers scan QR codes, browse menus, order, and pay via MoMo.

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Required
node >= 20.0.0
pnpm >= 10.18.3

# Install pnpm if needed
npm install -g pnpm@10.18.3
```

### 2. Install Dependencies

```bash
cd client-pwa
pnpm install --frozen-lockfile
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Add your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Development Server

```bash
pnpm dev
```

Visit: `http://localhost:3000`

### 5. Build for Production

```bash
pnpm build
pnpm start  # Test production build locally
```

## 📱 Features

- ✅ **QR Code Scanner** - Scan table → View menu
- ✅ **Menu Browsing** - Categories, search, filters
- ✅ **Smart Cart** - Persistent cart with modifiers
- ✅ **MoMo Payment** - Mobile Money integration (Rwanda)
- ✅ **Real-time Orders** - Live order tracking
- ✅ **PWA** - Offline support, installable

## 🏗️ Project Structure

```
client-pwa/
├── src/
│   ├── app/              # Next.js 15 app router
│   │   ├── page.tsx      # Home (QR scanner)
│   │   ├── menu/         # Menu browsing
│   │   └── checkout/     # Payment flow
│   ├── components/       # React components
│   │   ├── ui/           # Shadcn/ui components
│   │   ├── menu/         # Menu components
│   │   └── cart/         # Cart components
│   ├── lib/              # Utilities
│   │   ├── supabase.ts   # Supabase client
│   │   └── utils.ts      # Helpers
│   └── hooks/            # React hooks
├── public/               # Static assets
└── package.json
```

## 🔧 Common Tasks

### Development

```bash
pnpm dev          # Start dev server
pnpm lint         # Run ESLint
pnpm type-check   # Check TypeScript
pnpm test         # Run tests (if configured)
```

### Building

```bash
pnpm build        # Production build
pnpm start        # Serve production build
```

### Deployment

```bash
# Netlify (recommended)
netlify deploy --prod

# Or Vercel
vercel --prod
```

## 🎨 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 15.1.6 |
| UI | React | 18.3.1 |
| Styling | Tailwind CSS | 3.4.x |
| Components | Radix UI | Latest |
| State | Zustand | 5.x |
| Database | Supabase | 2.76.1 |
| Payments | MoMo API | Cloud API |

## 📚 Documentation

- **README.md** - Project overview and quick deploy
- **DEPLOYMENT.md** - Complete deployment guide
- **CONTRIBUTING.md** - Contribution guidelines
- **docs/archive/** - Historical documentation

## 🐛 Troubleshooting

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules .next
pnpm install --frozen-lockfile
pnpm build
```

### Environment Issues

```bash
# Verify environment variables
pnpm exec next info

# Check Supabase connection
curl $NEXT_PUBLIC_SUPABASE_URL/rest/v1/
```

### Type Errors

```bash
# Regenerate types from Supabase
pnpm supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
```

## 🆘 Support

- **Documentation**: See `docs/` directory
- **Issues**: File in GitHub repository
- **Team**: Contact easyMO development team

## 🚀 Next Steps

1. Read **DEPLOYMENT.md** for production deployment
2. Review **CONTRIBUTING.md** if you're contributing code
3. Check **docs/archive/** for additional context

---

**Status**: ✅ Production Ready  
**Last Updated**: December 1, 2025
