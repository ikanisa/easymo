# Quick Start - EasyMO Client PWA

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies

```bash
# Make sure you're in the client-pwa directory
pwd  # Should show: /path/to/easymo-/client-pwa

# Install with pnpm (NOT npm!)
pnpm install
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your Supabase credentials
nano .env.local  # or use your favorite editor
```

**Required values:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
```

### Step 3: Start Development

```bash
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002) in your browser.

### Step 4: Test on Mobile

```bash
# Get your local IP address
# macOS:
ipconfig getifaddr en0

# Linux:
hostname -I | awk '{print $1}'

# Windows (PowerShell):
(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi).IPAddress
```

Then on your phone, visit: `http://YOUR_IP_ADDRESS:3002`

## 📱 What You'll See

1. **Landing Page** - QR scan CTA and feature showcase
2. **Dark theme** - Optimized for bars/restaurants
3. **PWA banner** - "Add to Home Screen" prompt (on mobile)

## 🎯 Next Steps

### Create the Database Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Venues
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  currency TEXT DEFAULT 'RWF',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Categories
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  emoji TEXT,
  display_order INT DEFAULT 0,
  UNIQUE(venue_id, slug)
);

-- Menu Items
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id),
  category_id UUID REFERENCES menu_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Public read access (authenticated write via Bar Manager)
CREATE POLICY "Public venues are viewable by everyone"
  ON venues FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public menu categories are viewable by everyone"
  ON menu_categories FOR SELECT
  USING (true);

CREATE POLICY "Available menu items are viewable by everyone"
  ON menu_items FOR SELECT
  USING (is_available = true);
```

### Add Sample Data

```sql
-- Insert a test venue
INSERT INTO venues (name, slug, logo_url, currency)
VALUES (
  'Heaven Restaurant & Bar',
  'heaven-bar',
  'https://placehold.co/400x400/f9a825/0a0a0a?text=Heaven',
  'RWF'
);

-- Insert categories
INSERT INTO menu_categories (venue_id, name, slug, emoji, display_order)
SELECT 
  v.id,
  unnest(ARRAY['Appetizers', 'Main Dishes', 'Drinks', 'Desserts']),
  unnest(ARRAY['appetizers', 'mains', 'drinks', 'desserts']),
  unnest(ARRAY['🥗', '🍕', '🍺', '🍰']),
  unnest(ARRAY[1, 2, 3, 4])
FROM venues v WHERE slug = 'heaven-bar';

-- Insert sample menu items
INSERT INTO menu_items (venue_id, category_id, name, description, price, is_popular)
SELECT 
  v.id,
  c.id,
  'Margherita Pizza',
  'Classic tomato, mozzarella, and basil',
  12000,
  true
FROM venues v
JOIN menu_categories c ON c.venue_id = v.id
WHERE v.slug = 'heaven-bar' AND c.slug = 'mains';
```

### Implement Next Components

See `IMPLEMENTATION.md` for the full roadmap. Start with:

1. **Supabase Client** (`lib/supabase/client.ts`)
2. **Base UI Components** (`components/ui/Button.tsx`, etc.)
3. **Menu Components** (already have specs in your original doc)

## 🛠️ Useful Commands

```bash
# Development
pnpm dev              # Start dev server

# Type Checking
pnpm type-check       # Check TypeScript errors

# Building
pnpm build            # Production build
pnpm start            # Run production build

# Code Quality
pnpm lint             # Run ESLint (once configured)

# Testing (after setup)
pnpm test             # Run Vitest tests
pnpm test:e2e         # Run Playwright E2E
```

## 📁 File Structure Overview

```
client-pwa/
├── app/                    # Next.js 15 App Router
│   ├── layout.tsx         # Root layout ✅
│   ├── page.tsx           # Landing page ✅
│   ├── globals.css        # Styles ✅
│   └── manifest.ts        # PWA manifest ✅
├── components/
│   ├── ui/                # Base components (TODO)
│   ├── menu/              # Menu components (TODO)
│   └── cart/              # Cart components (TODO)
├── lib/
│   ├── design-tokens.ts   # Design system ✅
│   └── utils.ts           # Utilities ✅
├── stores/
│   └── cart.store.ts      # Cart state ✅
├── hooks/
│   ├── useHaptics.ts      # Haptic feedback ✅
│   └── usePWA.ts          # PWA install ✅
└── types/                 # TypeScript types ✅
```

## 🐛 Troubleshooting

### "Module not found" errors
```bash
# Clear cache and reinstall
rm -rf node_modules .next
pnpm install
```

### Port 3002 already in use
```bash
# Change port in package.json or kill the process
lsof -ti:3002 | xargs kill -9
```

### Supabase connection fails
- Check `.env.local` has correct values
- Verify Supabase project is running
- Check browser console for errors

### PWA not installing
- Must use HTTPS (or localhost)
- Check browser console for manifest errors
- Try in Incognito mode

## 📚 Documentation

- **Full README**: [README.md](./README.md)
- **Implementation Guide**: [IMPLEMENTATION.md](./IMPLEMENTATION.md)
- **Project Summary**: [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)

## 🎯 Current Status

**✅ Phase 1 Complete**: Foundation ready
- Project structure ✅
- Configuration files ✅
- Type system ✅
- State management ✅
- Landing page ✅

**🚧 Phase 2 Next**: Core components
- Supabase integration
- Menu browsing
- Cart functionality

**Estimated time to MVP**: 2-3 weeks

## 💡 Pro Tips

1. **Always use pnpm**, not npm (monorepo requirement)
2. **Test on real mobile devices** early and often
3. **Use browser DevTools mobile emulation** for quick testing
4. **Enable "Preserve log"** in DevTools Network tab
5. **Install React DevTools** for debugging

## 🚀 You're Ready!

Your foundation is solid. Start with:

```bash
pnpm install && pnpm dev
```

Then follow `IMPLEMENTATION.md` Phase 2 to build out the features.

**Happy coding! 🎉**
