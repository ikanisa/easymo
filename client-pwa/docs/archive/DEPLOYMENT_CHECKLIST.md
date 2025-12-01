# ✅ EasyMO Client PWA - Deployment Checklist

Use this checklist to ensure smooth deployment.

## Pre-Deployment ✅

- [x] **Dependencies Installed** - `pnpm install` completed
- [x] **Environment Variables** - `.env.local` configured with Supabase
- [x] **TypeScript Passing** - `pnpm type-check` returns no errors
- [x] **Build Successful** - `pnpm build` completes successfully
- [x] **ESLint Clean** - No linting errors
- [x] **Components Built** - All 40+ components created
- [x] **PWA Configured** - next-pwa installed and configured
- [x] **Missing Types Added** - qr-scanner, next-pwa types created

## Deployment Day 🚀

### Step 1: Deploy to Netlify

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
netlify deploy --prod
```

- [ ] **Netlify CLI Installed** - `npm install -g netlify-cli`
- [ ] **Logged in to Netlify** - `netlify login`
- [ ] **Site Initialized** - `netlify init` (first time only)
- [ ] **Production Deploy** - `netlify deploy --prod`
- [ ] **Deployment Successful** - Check Netlify dashboard

### Step 2: Configure Environment Variables in Netlify

Go to: Netlify Dashboard → Site Settings → Environment Variables

Add these variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://db.lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcnduZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1OTA1NzEsImV4cCI6MjA0NzE2NjU3MX0.3zgWc2vYOovN2j6YwUF2N4TqQNz0l_NLc0uUAGmjdSc
NEXT_PUBLIC_SITE_URL=https://your-site.netlify.app
```

- [ ] **Variables Added** - All 3 environment variables configured
- [ ] **Site URL Updated** - Replace with actual Netlify URL

### Step 3: Database Setup

Run these SQL commands in Supabase Dashboard → SQL Editor:

```sql
-- Create venues table
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'RWF',
  category TEXT,
  emoji TEXT,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false,
  prep_time_minutes INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id),
  status TEXT DEFAULT 'pending',
  total_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT,
  payment_status TEXT,
  table_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public read active venues" ON venues FOR SELECT USING (is_active = true);
CREATE POLICY "Public read available menu items" ON menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Read own orders" ON orders FOR SELECT USING (true);
```

- [ ] **Tables Created** - venues, menu_items, orders
- [ ] **RLS Enabled** - Row Level Security active
- [ ] **Policies Created** - Public read policies set

### Step 4: Add Test Data

```sql
-- Add test venue
INSERT INTO venues (slug, name, description, logo_url, is_active)
VALUES (
  'test-restaurant',
  'Test Restaurant',
  'A test venue for development',
  null,
  true
);

-- Add test menu items (get venue_id from above insert)
INSERT INTO menu_items (venue_id, name, description, price, category, emoji, is_available)
VALUES
  ((SELECT id FROM venues WHERE slug = 'test-restaurant'), 'Margherita Pizza', 'Classic tomato and mozzarella', 12000, 'mains', '🍕', true),
  ((SELECT id FROM venues WHERE slug = 'test-restaurant'), 'Caesar Salad', 'Fresh romaine with parmesan', 8000, 'appetizers', '🥗', true),
  ((SELECT id FROM venues WHERE slug = 'test-restaurant'), 'Coca Cola', 'Cold soft drink', 2000, 'drinks', '🥤', true);
```

- [ ] **Test Venue Added** - Can access at `/test-restaurant`
- [ ] **Menu Items Added** - At least 3 items for testing
- [ ] **Verified in Supabase** - Data visible in dashboard

### Step 5: Test Deployment

Open your deployed site and test:

- [ ] **Site Loads** - No errors in console
- [ ] **PWA Prompt** - Install prompt appears (Android Chrome)
- [ ] **Menu Loads** - Test venue menu displays
- [ ] **Cart Works** - Add items, persist on refresh
- [ ] **QR Scanner** - Camera access works (HTTPS only)
- [ ] **Mobile Responsive** - Looks good on phone
- [ ] **Dark Mode** - Proper contrast and visibility

### Step 6: Generate QR Codes

For each table, generate QR codes with this format:

```
https://your-site.netlify.app/test-restaurant?table=1
https://your-site.netlify.app/test-restaurant?table=2
https://your-site.netlify.app/test-restaurant?table=3
```

Use a QR code generator: https://www.qr-code-generator.com/

- [ ] **QR Codes Generated** - For all tables
- [ ] **Tested QR Scan** - Scans open correct venue
- [ ] **Table Number Captured** - Shows in order

### Step 7: Performance Testing

Run Lighthouse audit (Chrome DevTools):

```bash
# Or use CLI
lighthouse https://your-site.netlify.app --view
```

Target scores:
- **Performance**: 95+
- **Accessibility**: 90+
- **Best Practices**: 95+
- **SEO**: 90+
- **PWA**: 100

- [ ] **Lighthouse Run** - Audit completed
- [ ] **Performance >95** - Fast loading
- [ ] **PWA Score 100** - All PWA criteria met
- [ ] **Accessibility >90** - WCAG compliant

### Step 8: Final Checks

- [ ] **Custom Domain** - Configure if needed
- [ ] **HTTPS Enabled** - Automatic with Netlify
- [ ] **Error Tracking** - Set up Sentry (optional)
- [ ] **Analytics** - Configure if needed
- [ ] **Payment Integration** - MoMo/Revolut API keys
- [ ] **Push Notifications** - VAPID keys configured

## Post-Deployment 📊

### Monitor

- [ ] **Check Error Logs** - Netlify Functions logs
- [ ] **Monitor Performance** - Netlify Analytics
- [ ] **User Feedback** - Test with real users
- [ ] **Mobile Testing** - Test on iOS/Android

### Optimize

- [ ] **Image Optimization** - Compress images further
- [ ] **Bundle Analysis** - Check for large dependencies
- [ ] **Caching Strategy** - Review service worker cache
- [ ] **Database Indexes** - Add if queries slow

## Troubleshooting 🔧

### Build Fails

```bash
# Clear and rebuild
rm -rf .next node_modules
pnpm install
pnpm build
```

### Environment Variables Not Working

1. Check Netlify dashboard → Environment variables
2. Redeploy after adding variables
3. Clear cache and hard refresh browser

### Database Connection Issues

1. Verify Supabase URL in environment
2. Check RLS policies allow public read
3. Verify anon key (not service role key)

### QR Scanner Not Working

1. Must be HTTPS (Netlify provides this)
2. Check camera permissions in browser
3. Test on real mobile device

## Success Criteria ✅

Your deployment is successful when:

- ✅ Site loads without errors
- ✅ PWA can be installed on mobile
- ✅ Menu displays correctly
- ✅ Cart persists across refresh
- ✅ QR scanner accesses camera
- ✅ Lighthouse score >95
- ✅ Responsive on all devices
- ✅ Real-time updates work

## Next Steps 🚀

1. **Week 1**: Monitor usage, fix bugs
2. **Week 2**: Add more venues and menus
3. **Week 3**: Integrate payment APIs
4. **Month 1**: Add features (reviews, loyalty)

---

**Need Help?**

- 📖 **Documentation**: See all `*.md` files
- 🚀 **Deploy Guide**: READY_FOR_DEPLOYMENT.md
- 📋 **Full Summary**: FINAL_SUMMARY.md

---

**Deployment Date**: _________________  
**Deployed By**: _________________  
**Site URL**: _________________  
**Status**: ⬜ Planning → ⬜ Deploying → ⬜ Testing → ⬜ Live! 🎉
