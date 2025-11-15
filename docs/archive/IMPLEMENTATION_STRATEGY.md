# Complete Implementation Strategy

## Database URL & Credentials
- **Database URL**: postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres
- **PAT**: sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0

## Phase 1: Database Cleanup & Synchronization

### 1.1 Business Tables Merge (business vs businesses)
**Problem**: Two conflicting tables
- `businesses`: Receives WhatsApp flow registrations
- `business`: Contains full business database

**Solution**: Merge into single `business` table

### 1.2 Business Table Column Fixes
**Issues**:
- `category_id` contains slug/tag content (should be tag)
- Missing `category_name` column
- Missing proper `category_id` (UUID FK)

**Actions**:
1. Rename `category_id` → `tag`
2. Add `category_name` TEXT column
3. Add proper `category_id` UUID column (FK to service_categories)

### 1.3 Service Categories Table Setup
Create and populate `service_categories` table with:
- Pharmacies 💊
- Quincailleries 🔧
- Shops & Services 🏬
- Property Rentals 🏡
- Notary Services 📜
- Bars & Restaurants 🍽️

### 1.4 Location Data Extraction
**Issue**: `url` column contains Google Maps URLs
**Actions**:
1. Rename `url` → `maps_url`
2. Extract lat/lng using Google Geocoding API
3. Populate `latitude` and `longitude` columns
4. **Google Maps API Key**: AIzaSyCVbVWLFl5O2TdL7zDAjM08ws9D6IxPEFw

## Phase 2: GitHub Synchronization

### 2.1 Commit Untracked Files
```bash
git add WAITER_AI_IMPLEMENTATION_VISUAL.txt WAITER_AI_PWA_FINAL_STATUS.md WAITER_AI_QUICK_REF.md
git commit -m "docs: Add Waiter AI implementation documentation"
git push origin main
```

### 2.2 Verify Sync Status
- Check GitHub matches local
- Ensure all branches are up to date

## Phase 3: Waiter AI PWA Implementation

### Current Status
✅ Phase 1: Database schema & setup
✅ Phase 2: Core AI agent infrastructure  
✅ Phase 3A: Restaurant onboarding UI
✅ Phase 3B: Chat interface (80% complete)

### Remaining Work

#### Phase 3C: Menu Browser (1 day)
- [ ] Menu categories display
- [ ] Item cards with images
- [ ] Search & filters
- [ ] Add to cart functionality
- [ ] Offline caching

#### Phase 3D: Cart & Checkout (2 days)
- [ ] Shopping cart UI
- [ ] Order summary
- [ ] USSD payment flow (no API)
- [ ] Revolut payment link integration
- [ ] Order confirmation

#### Phase 3E: Multilingual UI (1 day)
- [ ] Complete i18n routing setup
- [ ] EN/FR/ES/PT/DE translations
- [ ] Language switcher
- [ ] RTL support if needed

#### Phase 3F: Offline Support (1 day)
- [ ] Service worker implementation
- [ ] Cache strategies
- [ ] Offline fallback pages
- [ ] Background sync

#### Phase 3G: Polish & Testing (1 day)
- [ ] PWA manifest optimization
- [ ] Icon generation (all sizes)
- [ ] Lighthouse audits
- [ ] Cross-browser testing
- [ ] Performance optimization

## Implementation Order

1. **Database Cleanup** (2-3 hours)
   - Run SQL migrations
   - Populate categories
   - Extract coordinates

2. **GitHub Sync** (15 minutes)
   - Commit docs
   - Push to main
   - Verify remote

3. **Waiter AI Phases** (6 days)
   - Phase 3C: Menu Browser
   - Phase 3D: Cart & Checkout
   - Phase 3E: Multilingual
   - Phase 3F: Offline
   - Phase 3G: Polish

## Key Constraints

### Payment Integration
- **Mobile Money**: USSD-based (no API integration)
- **Revolut**: Payment link stored in provider profile
- User clicks "Pay" → Revolut link opens → Manual payment

### Tech Stack
- Frontend: Next.js 14, React 18, TypeScript
- Backend: Supabase (Edge Functions)
- AI: OpenAI Responses API + Agents SDK
- Styling: Tailwind CSS
- i18n: next-intl
- PWA: next-pwa

## Next Steps

Run this strategy:
```bash
# 1. Database cleanup
cd /Users/jeanbosco/workspace/easymo-
# Execute SQL migrations

# 2. Sync GitHub
git add . && git commit -m "chore: sync documentation" && git push

# 3. Continue Waiter AI
cd waiter-pwa
pnpm dev
```
