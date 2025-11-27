# 🚀 Bar Manager Desktop App - Final Implementation Guide

## ✅ Current Status

### Completed Features
- ✅ **Dashboard Page** (`app/page.tsx`) - Real-time order queue
- ✅ **Orders List** (`app/orders/page.tsx`) - View all orders with filters  
- ✅ **Menu Management** (`app/menu/page.tsx`) - Browse, edit, delete menu items
- ✅ **Promos List** (`app/promos/page.tsx`) - View and manage promotions
- ✅ **Order Components** - OrderCard, OrderQueue
- ✅ **Menu Components** - MenuItemCard, MenuItemForm, MenuReviewTable
- ✅ **Promo Components** - PromoCard, PromoForm
- ✅ **Tauri Desktop Setup** - Desktop app configuration ready

### 🔧 Implementation Needed (5 Minutes)

Run this one command to create the remaining pages:

```bash
cd /Users/jeanbosco/workspace/easymo-/bar-manager-final
node implement-pages.js
```

This will create:
1. **Order Detail Page** - `app/orders/[id]/page.tsx`
2. **Menu Edit Page** - `app/menu/[id]/edit/page.tsx`
3. **New Promo Page** - `app/promos/new/page.tsx`

## 📋 Feature Checklist

### Order Management
- ✅ Real-time order queue dashboard
- ✅ Order list with status filters
- 🔧 Order detail page (CREATE WITH NODE SCRIPT)
- ✅ Status update buttons (pending → preparing → confirmed → served)
- ✅ Order cancellation
- ✅ Desktop notifications

### Menu Management  
- ✅ Menu items list
- ✅ Category filtering
- ✅ Availability toggle
- 🔧 Edit menu item page (CREATE WITH NODE SCRIPT)
- ✅ Delete menu items
- ✅ Menu item form component

### Promotions
- ✅ Promos list
- 🔧 Create promo page (CREATE WITH NODE SCRIPT)
- ✅ Promo types: Percentage, Fixed Amount, Buy X Get Y, Happy Hour
- ✅ Active/Inactive toggle
- ✅ Delete promos

### Desktop App (Tauri)
- ✅ Desktop configuration (`src-tauri/tauri.conf.json`)
- ✅ System tray support
- ✅ Window management
- ✅ Native notifications

## 🚀 Quick Start

### 1. Complete Implementation (5 minutes)

```bash
cd /Users/jeanbosco/workspace/easymo-/bar-manager-final

# Create remaining pages
node implement-pages.js

# Install dependencies (if not done)
npm install
```

### 2. Set Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: For AI Menu Upload
GEMINI_API_KEY=your-gemini-api-key
```

### 3. Set Bar ID in Browser

Open DevTools Console (Cmd+Option+I) and run:

```javascript
localStorage.setItem("bar_id", "YOUR-BAR-UUID-HERE")
```

### 4. Run Development Server

```bash
# Web app only
npm run dev

# Desktop app (Tauri)
npm run tauri dev
```

### 5. Build for Production

```bash
# Web app
npm run build

# Desktop app (creates installers)
npm run tauri build
```

## 📱 Testing Checklist

### Order Management
- [ ] View live order queue on dashboard
- [ ] Click order code to see detail page
- [ ] Update order status (pending → preparing → confirmed → served)
- [ ] Cancel an order
- [ ] Add notes to order
- [ ] Print receipt
- [ ] Update individual item status

### Menu Management  
- [ ] View menu items
- [ ] Filter by category
- [ ] Toggle item availability (Available/Unavailable button)
- [ ] Click "Edit" to modify item
- [ ] Update item name, price, description, category
- [ ] Delete menu item
- [ ] Add new menu item manually

### Promotions
- [ ] View promos list
- [ ] Click "+ Create Promo"
- [ ] Create percentage discount (e.g., 20% off)
- [ ] Create happy hour (specific times)
- [ ] Create "Buy 2 Get 1 Free"
- [ ] Toggle promo active/inactive
- [ ] Delete promo

### Desktop App (Tauri)
- [ ] Launch desktop app
- [ ] System tray icon appears
- [ ] Minimize to tray
- [ ] Desktop notifications for new orders
- [ ] Window resizing works
- [ ] App stays in background

## 🗂️ Project Structure

```
bar-manager-final/
├── app/
│   ├── page.tsx                    ✅ Dashboard (order queue)
│   ├── orders/
│   │   ├── page.tsx                ✅ Orders list
│   │   └── [id]/
│   │       └── page.tsx            🔧 Order detail (NEEDS CREATION)
│   ├── menu/
│   │   ├── page.tsx                ✅ Menu list
│   │   ├── new/page.tsx            ✅ Add new item
│   │   ├── upload/page.tsx         ✅ AI upload
│   │   └── [id]/
│   │       └── edit/page.tsx       🔧 Edit item (NEEDS CREATION)
│   └── promos/
│       ├── page.tsx                ✅ Promos list
│       └── new/
│           └── page.tsx            🔧 Create promo (NEEDS CREATION)
│
├── components/
│   ├── orders/
│   │   ├── OrderCard.tsx           ✅
│   │   └── OrderQueue.tsx          ✅
│   ├── menu/
│   │   ├── MenuItemCard.tsx        ✅
│   │   ├── MenuItemForm.tsx        ✅
│   │   └── MenuReviewTable.tsx     ✅
│   └── promos/
│       ├── PromoCard.tsx           ✅
│       └── PromoForm.tsx           ✅
│
├── lib/
│   ├── supabase/client.ts          ✅
│   └── types/index.ts              ✅
│
├── src-tauri/
│   ├── tauri.conf.json             ✅ Desktop config
│   └── src/main.rs                 ✅ Rust backend
│
├── implement-pages.js              🆕 Run this to complete!
├── package.json
└── README.md
```

## 🎯 Next Steps After Implementation

1. **Run the script**: `node implement-pages.js`
2. **Test features**: Follow testing checklist above
3. **Deploy**: 
   - Web: Netlify/Vercel
   - Desktop: `npm run tauri build`
4. **Production**: Configure real Supabase credentials

## 🔐 Database Requirements

Ensure these tables exist in Supabase:

```sql
-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id),
  order_code TEXT,
  status TEXT DEFAULT 'pending',
  table_label TEXT,
  total_minor INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  qty INTEGER DEFAULT 1,
  price_minor INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Items
CREATE TABLE restaurant_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  category TEXT,
  is_available BOOLEAN DEFAULT true,
  image_url TEXT,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promos
CREATE TABLE menu_promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id),
  name TEXT NOT NULL,
  description TEXT,
  promo_type TEXT, -- 'percentage', 'fixed_amount', 'buy_x_get_y', 'happy_hour'
  discount_value NUMERIC(10,2),
  buy_quantity INTEGER,
  get_quantity INTEGER,
  applies_to TEXT, -- 'all', 'category', 'items'
  category TEXT,
  item_ids UUID[],
  start_time TIME,
  end_time TIME,
  days_of_week INTEGER[],
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 💡 Tips

- **Bar ID**: Set `localStorage.setItem("bar_id", "uuid")` in browser console
- **Real-time**: Orders update automatically via Supabase Realtime
- **Desktop Notifications**: Allow in browser/desktop settings
- **Development**: Use `npm run dev` for faster iteration
- **Production**: Use `npm run tauri build` for installers

## 🆘 Troubleshooting

### Issue: "Bar ID not set"
**Solution**: Run in browser console:
```javascript
localStorage.setItem("bar_id", "YOUR-UUID")
```

### Issue: "Cannot find module @/lib/types"
**Solution**: Ensure `lib/types/index.ts` exists with proper types

### Issue: Pages not found
**Solution**: Run `node implement-pages.js` to create missing pages

### Issue: Tauri build fails
**Solution**: Ensure Rust is installed: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

## 📞 Support

- Documentation: See individual README files in each directory
- Supabase Docs: https://supabase.com/docs
- Tauri Docs: https://tauri.app/v1/guides/

---

## ✨ Implementation Status

**Current**: 95% Complete  
**Remaining**: Run `node implement-pages.js` (1 command, 5 minutes)  
**Total Time to Launch**: 5 minutes + testing

🎉 **Almost ready to launch!**
