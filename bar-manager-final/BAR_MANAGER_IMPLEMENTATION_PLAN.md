# Bar Manager Desktop App - Complete Implementation Plan

## 📊 Current Status Analysis

### ✅ What's Already Implemented

Based on my analysis of `/bar-manager-final`, here's what exists:

#### Core Infrastructure
- ✅ **Tauri Desktop Setup** - `src-tauri/` directory with Cargo.toml and tauri.conf.json
- ✅ **Next.js 15 App** - Modern App Router setup
- ✅ **Supabase Client** - `lib/supabase/client.ts` configured
- ✅ **Notifications System** - `lib/notifications.ts` with desktop notification support
- ✅ **UI Components** - Comprehensive component library in `components/`

#### Pages Implemented
1. **Dashboard (/)** - `app/page.tsx`
   - ✅ Order queue with real-time updates
   - ✅ Live Supabase subscriptions
   - ✅ Desktop notifications for new orders
   - ✅ Status update functionality
   
2. **Orders List (/orders)** - `app/orders/page.tsx`
   - ✅ Full order history
   - ✅ Status filtering
   - ✅ Table view with sorting
   
3. **Menu Management (/menu)** - `app/menu/page.tsx`
   - ✅ Menu items grid
   - ✅ Category filtering
   - ✅ Availability toggle
   - ✅ Delete functionality
   - ✅ Links to AI upload and manual add

4. **Promos List (/promos)** - `app/promos/page.tsx`
   - ✅ Promotions grid
   - ✅ Active/inactive toggle
   - ✅ Delete functionality

#### Components Available
- ✅ **PromoCard** - `components/promos/PromoCard.tsx`
- ✅ **OrderQueue** - `components/orders/OrderQueue.tsx`
- ✅ **Notifications** - Desktop + sound support
- ✅ Extensive UI library (forms, tables, cards, etc.)

---

### ❌ What's Missing (Priority Order)

#### HIGH PRIORITY - Core Functionality (2-3 hours)

1. **Order Detail Page** - `/app/orders/[id]/page.tsx`
   - View full order details
   - See all items with quantities
   - View customer info
   - Order timeline/history
   - Update status from detail page

2. **Menu Edit Page** - `/app/menu/[id]/edit/page.tsx`
   - Edit existing menu item
   - Update name, price, description, category
   - Change availability
   - Upload/change image

3. **Menu Add Page** - `/app/menu/new/page.tsx`
   - Manual menu item creation form
   - All fields (name, category, price, description, image)
   - Validation
   - Success feedback

4. **Promo Creation Page** - `/app/promos/new/page.tsx`
   - Create new promotion
   - Configure discount type (%, fixed, buy-X-get-Y, happy hour)
   - Set validity dates and times
   - Choose applicable items/categories
   - Active days selection

#### MEDIUM PRIORITY - AI Features (4-5 hours)

5. **AI Menu Upload** - `/app/menu/upload/page.tsx`
   - File dropzone (images, PDFs, Excel, CSV)
   - Gemini 2.0 Flash integration
   - Real-time parsing progress
   - Review extracted items table
   - Bulk edit and save

6. **Gemini Parser Service** - `/lib/gemini/menu-parser.ts`
   - Image OCR extraction
   - PDF parsing
   - Spreadsheet parsing
   - Structured JSON output
   - Confidence scoring

7. **Menu Upload API** - `/app/api/menu/parse/route.ts`
   - Accept file uploads
   - Call Gemini API
   - Return extracted items
   - Error handling

#### LOW PRIORITY - Polish & UX (2-3 hours)

8. **Category Management** - `/app/menu/categories/page.tsx`
   - Add/edit/delete categories
   - Reorder categories
   - Set category icons

9. **Settings Page** - `/app/settings/page.tsx`
   - Bar profile settings
   - Notification preferences
   - Display settings (theme, language)
   - About/version info

10. **Dashboard Enhancements**
    - Statistics cards (daily revenue, order count)
    - Charts (orders over time, popular items)
    - Performance metrics

---

## 🚀 Implementation Plan

### Phase 1: Core CRUD Pages (Day 1 - 2.5 hours)

**Goal:** Complete all essential CRUD operations

#### Task 1.1: Order Detail Page (45 min)
```typescript
// app/orders/[id]/page.tsx
- Fetch order with items using Supabase
- Display order header (code, table, timestamp)
- List all order items with details
- Show order total
- Status update buttons
- Back to orders list link
```

**Files to create:**
- `app/orders/[id]/page.tsx`

**Dependencies:** None (Supabase client ready)

---

#### Task 1.2: Menu Edit Page (45 min)
```typescript
// app/menu/[id]/edit/page.tsx
- Fetch menu item by ID
- Pre-populate form with existing data
- Handle form submission
- Update item in Supabase
- Success/error feedback
- Redirect to menu list
```

**Files to create:**
- `app/menu/[id]/edit/page.tsx`

**Reuse:** `components/menu/MenuItemForm.tsx` (if exists, else create)

---

#### Task 1.3: Menu Add Page (30 min)
```typescript
// app/menu/new/page.tsx
- Empty form for new item
- Validation (required fields)
- Insert into Supabase
- Success redirect
```

**Files to create:**
- `app/menu/new/page.tsx`
- `components/menu/MenuItemForm.tsx` (shared with edit)

---

#### Task 1.4: Promo Creation Page (30 min)
```typescript
// app/promos/new/page.tsx
- Promo type selector
- Dynamic form based on promo type
- Date/time pickers
- Category/item selectors
- Save to Supabase
```

**Files to create:**
- `app/promos/new/page.tsx`
- `components/promos/PromoForm.tsx`

**Note:** PromoCard component already exists for display

---

### Phase 2: AI Menu Upload (Day 2 - 4 hours)

**Goal:** Enable AI-powered menu extraction from images/PDFs

#### Task 2.1: Gemini Client Setup (30 min)
```typescript
// lib/gemini/client.ts
- Initialize Google Generative AI
- Configure Gemini 2.0 Flash model
- Export vision and text models
```

**Environment variables needed:**
```bash
GEMINI_API_KEY=your_key_here
```

---

#### Task 2.2: Menu Parser Service (1.5 hours)
```typescript
// lib/gemini/menu-parser.ts
- parseMenuFromImage(base64, mimeType)
- parseMenuFromPDF(base64)
- parseMenuFromText(text)
- parseMenuFromSpreadsheet(rows)
- Return structured ExtractedMenuItem[]
```

**Output format:**
```typescript
interface ExtractedMenuItem {
  name: string
  category: string
  description: string | null
  price: number | null
  currency: string
  size: string | null
  alcohol_percentage: string | null
  is_available: boolean
  confidence: number // 0-1
}
```

---

#### Task 2.3: Upload API Route (30 min)
```typescript
// app/api/menu/parse/route.ts
- Accept POST with file data
- Convert to base64
- Call appropriate parser function
- Return JSON response
- Error handling
```

---

#### Task 2.4: File Dropzone Component (1 hour)
```typescript
// components/ui/FileDropzone.tsx
- react-dropzone integration
- Accept images, PDFs, Excel, CSV
- Drag & drop UI
- File validation
- Loading states
```

---

#### Task 2.5: Menu Upload Page (1.5 hours)
```typescript
// app/menu/upload/page.tsx
- FileDropzone component
- Upload progress indicator
- AI parsing status
- MenuReviewTable for extracted items
- Bulk edit functionality
- Save selected items to database
```

**Components:**
- `components/menu/MenuReviewTable.tsx` - Editable table for review
- `components/ui/ProgressBar.tsx` - Upload/parsing progress

---

### Phase 3: Polish & Launch (Day 3 - 2 hours)

#### Task 3.1: Database Schema (30 min)
Ensure these tables exist in Supabase:

```sql
-- Already exists (verify)
CREATE TABLE IF NOT EXISTS restaurant_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- in minor units
  currency TEXT DEFAULT 'RWF',
  is_available BOOLEAN DEFAULT true,
  ocr_extracted BOOLEAN DEFAULT false,
  ocr_confidence NUMERIC(3,2),
  image_url TEXT,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create if missing
CREATE TABLE IF NOT EXISTS menu_promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  promo_type TEXT NOT NULL,
  discount_value NUMERIC(10,2),
  buy_quantity INTEGER,
  get_quantity INTEGER,
  applies_to TEXT,
  category TEXT,
  item_ids UUID[],
  start_time TIME,
  end_time TIME,
  days_of_week INTEGER[],
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### Task 3.2: Testing & Bug Fixes (1 hour)
- Test all CRUD operations
- Test AI upload with sample menu images
- Test desktop notifications
- Fix any bugs found
- Test Tauri build

---

#### Task 3.3: Documentation (30 min)
- Update README with setup instructions
- Document environment variables
- Add usage guide
- Screenshot demos

---

## 📦 Files to Create (Complete Checklist)

### Pages (4 files)
- [ ] `app/orders/[id]/page.tsx` - Order detail view
- [ ] `app/menu/[id]/edit/page.tsx` - Edit menu item
- [ ] `app/menu/new/page.tsx` - Add menu item
- [ ] `app/promos/new/page.tsx` - Create promo
- [ ] `app/menu/upload/page.tsx` - AI menu upload

### Components (6 files)
- [ ] `components/menu/MenuItemForm.tsx` - Reusable form for add/edit
- [ ] `components/menu/MenuReviewTable.tsx` - Review extracted items
- [ ] `components/promos/PromoForm.tsx` - Promo creation form
- [ ] `components/ui/FileDropzone.tsx` - Drag & drop file upload
- [ ] `components/ui/ProgressBar.tsx` - Progress indicator

### Lib/API (3 files)
- [ ] `lib/gemini/client.ts` - Gemini AI client
- [ ] `lib/gemini/menu-parser.ts` - Menu parsing logic
- [ ] `app/api/menu/parse/route.ts` - Upload & parse API

---

## 🎯 Success Criteria

### Minimum Viable Product (MVP)
- ✅ View live order queue
- ✅ Update order status
- ✅ Desktop notifications
- ⬜ View order details
- ⬜ Add/edit/delete menu items
- ⬜ Create/manage promos
- ⬜ AI menu upload from images
- ✅ Run as desktop app (Tauri)

### Full Feature Set
- ⬜ AI upload from PDFs and Excel
- ⬜ Category management
- ⬜ Dashboard statistics
- ⬜ Settings page
- ⬜ Offline support
- ⬜ Auto-updates

---

## 🚀 Quick Start Commands

### Development
```bash
cd /Users/jeanbosco/workspace/easymo-/bar-manager-final

# Install dependencies (if not done)
npm install

# Run development server
npm run dev
# Opens at http://localhost:3000

# Run as desktop app
npm run tauri:dev
```

### Build for Production
```bash
# Build Next.js
npm run build

# Build Tauri desktop app (Windows/Mac/Linux)
npm run tauri:build
# Outputs to src-tauri/target/release/
```

---

## ⏱️ Time Estimates

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1: Core CRUD | Order detail, Menu edit, Menu add, Promo create | 2.5 hours |
| Phase 2: AI Upload | Gemini setup, Parser, API, UI | 4 hours |
| Phase 3: Polish | Schema, Testing, Docs | 2 hours |
| **Total** | **10 tasks** | **8.5 hours** |

With breaks and debugging, expect **2-3 working days** for complete implementation.

---

## 🔑 Environment Variables Needed

Add to `/bar-manager-final/.env.local`:

```bash
# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=https://vacltfdslodqybxojytc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini AI (NEW - required for Phase 2)
GEMINI_API_KEY=your_gemini_api_key

# Optional: Bar ID for testing
NEXT_PUBLIC_DEFAULT_BAR_ID=your_test_bar_id
```

---

## 📚 Dependencies Already Installed

Checking `package.json`:
- ✅ `@google/generative-ai` - Gemini AI SDK
- ✅ `react-dropzone` - File upload
- ✅ `@supabase/supabase-js` - Database client
- ✅ `@tauri-apps/api` - Desktop APIs
- ✅ All Tauri plugins (notifications, dialog, fs, etc.)

**No new dependencies needed!**

---

## 🎨 UI/UX Guidelines

### Order Detail Page
- Clear header with order code and status
- Grouped items by category
- Prominent status update buttons
- Order timeline (timestamps for each status)

### Menu Forms
- Required field indicators
- Real-time validation
- Image upload preview
- Category autocomplete
- Price input in RWF (convert to minor units)

### AI Upload
- Clear instructions and examples
- Supported file types prominently shown
- Real-time progress indicator
- Confidence scores for each extracted item
- Easy bulk editing (select all, category assign)

### Promos
- Visual promo type selector (cards with icons)
- Dynamic form (only show relevant fields)
- Day selector (weekday buttons)
- Date range picker
- Preview of promo before saving

---

## 🐛 Known Issues & Considerations

1. **Bar ID Storage**
   - Currently uses `localStorage.getItem("bar_id")`
   - Consider adding bar selection on first launch
   - Or environment variable for single-bar deployments

2. **Error Handling**
   - Add proper error boundaries
   - Toast notifications for API failures
   - Retry logic for network issues

3. **Loading States**
   - All forms need loading spinners
   - Disable buttons during submission
   - Skeleton loaders for data fetching

4. **Validation**
   - Client-side validation with visual feedback
   - Server-side validation in API routes
   - Proper error messages

5. **Image Upload**
   - Need image storage solution (Supabase Storage)
   - Image compression before upload
   - Format validation (JPEG, PNG, WebP)

---

## 📞 Support & Resources

- **Gemini API Docs**: https://ai.google.dev/gemini-api/docs
- **Tauri Docs**: https://tauri.app/v1/guides/
- **Supabase Realtime**: https://supabase.com/docs/guides/realtime
- **Next.js App Router**: https://nextjs.org/docs/app

---

## ✅ Implementation Checklist

### Pre-Implementation
- [x] Analyze existing codebase
- [x] Identify missing components
- [x] Create detailed plan
- [ ] Get Gemini API key
- [ ] Verify Supabase tables exist
- [ ] Set up environment variables

### Phase 1: Core Pages (2.5 hours)
- [ ] Create order detail page
- [ ] Create menu edit page
- [ ] Create menu add page
- [ ] Create promo creation page
- [ ] Test all CRUD operations

### Phase 2: AI Upload (4 hours)
- [ ] Set up Gemini client
- [ ] Implement menu parser
- [ ] Create upload API route
- [ ] Build file dropzone component
- [ ] Build upload page with review table
- [ ] Test with sample menus

### Phase 3: Launch (2 hours)
- [ ] Verify database schema
- [ ] Full integration testing
- [ ] Fix bugs
- [ ] Update documentation
- [ ] Build Tauri desktop app
- [ ] Test installation on target OS

---

## 🎉 What's Next After MVP?

1. **Analytics Dashboard**
   - Daily/weekly/monthly sales
   - Popular items chart
   - Peak hours analysis
   - Revenue trends

2. **Inventory Management**
   - Stock tracking
   - Low stock alerts
   - Automatic reorder suggestions

3. **Staff Management**
   - Waiter accounts
   - Performance tracking
   - Shift scheduling

4. **Customer Features**
   - Order history per table
   - Customer preferences
   - Loyalty program integration

5. **Advanced AI**
   - Menu item recommendations
   - Price optimization
   - Demand forecasting
   - Automated responses to customer feedback

---

**Ready to implement? Start with Phase 1, Task 1.1: Order Detail Page!**
