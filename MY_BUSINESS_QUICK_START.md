# 🏪 My Business Workflow - Quick Start Guide

**TL;DR:** 80% done, 2-3 days to complete integration.

---

## 🎯 Current Status

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Business CRUD | ✅ Complete | None |
| Restaurant Menu | ✅ Complete | None |
| Profile Menu | ✅ Complete | None |
| **Integration** | ⚠️ **Partial** | **Wire components** |

---

## 🚀 Phase 1: Integration (2-3 Days)

### Critical Changes Required

#### 1. Update wa-webhook-profile Router (4 hours)

**File:** `supabase/functions/wa-webhook-profile/index.ts`

Add after line 279:

```typescript
// Business Detail Selection
else if (id.startsWith("biz::")) {
  const businessId = id.replace("biz::", "");
  const { showBusinessDetail } = await import(
    "../wa-webhook/domains/business/management.ts"
  );
  handled = await showBusinessDetail(ctx, businessId);
}

// Manage Menu
else if (id === IDS.BUSINESS_MANAGE_MENU && state?.key === "business_detail") {
  const { startRestaurantManager } = await import(
    "../wa-webhook/domains/vendor/restaurant.ts"
  );
  const barId = state.data?.barId as string;
  handled = await startRestaurantManager(ctx, { barId, initialAction: "menu" });
}

// View Orders
else if (id === IDS.BUSINESS_VIEW_ORDERS && state?.key === "business_detail") {
  const { startRestaurantManager } = await import(
    "../wa-webhook/domains/vendor/restaurant.ts"
  );
  const barId = state.data?.barId as string;
  handled = await startRestaurantManager(ctx, { barId, initialAction: "orders" });
}
```

#### 2. Update Business Detail State (2 hours)

**File:** `supabase/functions/wa-webhook-profile/business/list.ts`

```typescript
export async function handleBusinessSelection(
  ctx: RouterContext,
  businessId: string
): Promise<boolean> {
  const { data: business } = await ctx.supabase
    .from("business")
    .select("*")
    .eq("id", businessId)
    .single();
  
  // ⚡ CRITICAL: Store bar_id in state
  await setState(ctx.supabase, ctx.profileId!, {
    key: "business_detail",
    data: {
      businessId,
      barId: business.bar_id, // ⚡ Required for menu management
      businessName: business.name,
    },
  });
  
  // Forward to main webhook handler
  const { showBusinessDetail } = await import(
    "../../wa-webhook/domains/business/management.ts"
  );
  return await showBusinessDetail(ctx, businessId);
}
```

#### 3. Add Business Type Detection (2 hours)

**File:** `supabase/functions/wa-webhook/domains/business/management.ts`

```typescript
function getBusinessType(business: Business): "restaurant" | "bar" | "shop" | "pharmacy" | null {
  // Check explicit type first
  if (business.business_type) {
    return business.business_type as any;
  }
  
  // Fallback to tag detection
  const slug = `${business.category_name ?? ""} ${business.tag ?? ""}`.toLowerCase();
  if (slug.includes("bar") || slug.includes("restaurant")) return "restaurant";
  if (slug.includes("pharmacy")) return "pharmacy";
  if (slug.includes("shop")) return "shop";
  
  return null;
}

export async function showBusinessDetail(
  ctx: RouterContext,
  businessId: string,
): Promise<boolean> {
  const { data: business } = await ctx.supabase
    .from("business")
    .select("*")
    .eq("id", businessId)
    .single();
  
  const businessType = getBusinessType(business);
  const rows = [];
  
  // ⚡ Only show menu management for restaurants/bars
  if (businessType === "restaurant" || businessType === "bar") {
    if (business.bar_id) {
      rows.push(
        { id: IDS.BUSINESS_MANAGE_MENU, title: "📋 Manage Menu" },
        { id: IDS.BUSINESS_VIEW_ORDERS, title: "📦 View Orders" }
      );
    }
  }
  
  // Common actions for all businesses
  rows.push(
    { id: IDS.BUSINESS_EDIT, title: "✏️ Edit Details" },
    { id: IDS.BUSINESS_SHARE_DEEPLINK, title: "🔗 Share Link" },
    { id: IDS.BUSINESS_DELETE, title: "🗑️ Delete Business" }
  );
  
  await sendListMessage(ctx, { rows });
  return true;
}
```

---

## 🧪 Testing Commands

```bash
# 1. Lint
pnpm lint

# 2. Type check
pnpm exec tsc --noEmit

# 3. Unit tests
pnpm exec vitest run

# 4. Deploy to staging
supabase functions deploy wa-webhook-profile --project-ref staging

# 5. Manual test flow
# - Send "Profile" via WhatsApp
# - Select "My Businesses"
# - Select a restaurant business
# - Verify "Manage Menu" appears
# - Tap "Manage Menu"
# - Verify menu editor opens
```

---

## 📊 Success Criteria

- [ ] Profile → My Businesses flow works
- [ ] Business list shows owned businesses
- [ ] Restaurant detail shows "Manage Menu"
- [ ] Non-restaurant hides "Manage Menu"
- [ ] Menu editor opens correctly
- [ ] Menu items can be added/edited/deleted
- [ ] Back navigation works at all levels
- [ ] No console errors in logs

---

## 🐛 Common Issues

### Issue: "Manage Menu" not showing

**Check:**
```sql
SELECT id, name, tag, category_name, bar_id 
FROM business 
WHERE owner_user_id = '<user_id>';
```

**Fix:** Ensure `bar_id` is set and `tag` or `category_name` contains "restaurant" or "bar"

### Issue: Menu editor fails to load

**Check:**
```sql
SELECT * FROM bar_managers 
WHERE user_id = '<user_id>' 
AND bar_id = '<bar_id>' 
AND is_active = true;
```

**Fix:** Add bar manager entry
```sql
INSERT INTO bar_managers (bar_id, user_id, is_active)
VALUES ('<bar_id>', '<user_id>', true);
```

### Issue: State lost between screens

**Check:** Look for state persistence in logs
```bash
supabase functions logs wa-webhook-profile | grep "PROFILE_STATE"
```

**Fix:** Ensure `setState()` is called with correct `key` before navigation

---

## 📁 Key Files

```
supabase/functions/
├── wa-webhook-profile/
│   ├── index.ts                ← ADD ROUTING HERE
│   ├── business/
│   │   ├── list.ts             ← UPDATE STATE HERE
│   │   ├── create.ts           ✅ Complete
│   │   ├── update.ts           ✅ Complete
│   │   └── delete.ts           ✅ Complete
│   └── profile/
│       └── home_dynamic.ts     ✅ Complete
└── wa-webhook/
    ├── domains/
    │   ├── business/
    │   │   └── management.ts   ← ADD TYPE DETECTION HERE
    │   └── vendor/
    │       └── restaurant.ts   ✅ Complete (menu management)
    └── wa/
        └── ids.ts              ✅ Has all constants
```

---

## 🚢 Deployment

```bash
#!/bin/bash
# deploy-my-business.sh

set -e

echo "🏪 Deploying My Business Integration..."

# 1. Run checks
echo "Running lint..."
pnpm lint

echo "Running type check..."
pnpm exec tsc --noEmit

echo "Running tests..."
pnpm exec vitest run

# 2. Deploy functions
echo "Deploying wa-webhook-profile..."
supabase functions deploy wa-webhook-profile

echo "Deploying wa-webhook..."
supabase functions deploy wa-webhook

# 3. Verify deployment
echo "Testing health endpoints..."
curl https://nytxcdvxutrtqrukdscu.supabase.co/functions/v1/wa-webhook-profile/health
curl https://nytxcdvxutrtqrukdscu.supabase.co/functions/v1/wa-webhook/health

echo "✅ Deployment complete!"
echo "📱 Test via WhatsApp: Send 'Profile' → 'My Businesses'"
```

---

## 📝 Phase 2 Preview (Menu Upload AI OCR)

**After Phase 1 is complete:**

1. Create `menu_upload_requests` table
2. Add OCR handler using Gemini Vision
3. Implement review & import flow
4. Deploy `ocr-processor` edge function

**Estimated:** 3-4 days

---

## 📝 Phase 3 Preview (Desktop App Integration)

**After Phase 2 is complete:**

1. Add magic link authentication
2. Implement real-time order subscriptions
3. Add desktop notifications
4. Deploy bar manager desktop app

**Estimated:** 4-5 days

---

## 🎓 Resources

- **Full Analysis:** `MY_BUSINESS_WORKFLOW_DEEP_ANALYSIS.md`
- **Architecture:** `bar-manager-app/ARCHITECTURE.md`
- **Existing Code:**
  - Business management: `wa-webhook/domains/business/management.ts`
  - Restaurant manager: `wa-webhook/domains/vendor/restaurant.ts`
  - Profile router: `wa-webhook-profile/index.ts`

---

## 💬 Support

**Questions?**
- Check full analysis document for detailed explanations
- Review existing code in `wa-webhook/domains/vendor/restaurant.ts`
- Test flow manually via WhatsApp before code changes

**Ready to start?**
```bash
git checkout -b feature/my-business-integration
# Make the 3 changes above
git commit -m "feat: integrate My Business workflow (Phase 1)"
git push origin feature/my-business-integration
```

---

**Last Updated:** December 6, 2025  
**Status:** ✅ Ready for implementation
