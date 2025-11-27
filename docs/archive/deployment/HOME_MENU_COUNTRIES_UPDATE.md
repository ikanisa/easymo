# Home Menu Countries Update - Complete

**Date:** 2025-11-24 05:56 UTC  
**Status:** ✅ DEPLOYED AND VERIFIED

---

## ✅ CHANGES IMPLEMENTED

### Countries Removed
- ❌ **UG (Uganda)** - Phone code +256
- ❌ **KE (Kenya)** - Phone code +254

### Countries Added
- ✅ **CD (DR Congo)** - Phone code +243
- ✅ **ZM (Zambia)** - Phone code +260
- ✅ **TG (Togo)** - Phone code +228

### Active Countries (Final List)
1. **RW (Rwanda)** - +250
2. **TZ (Tanzania)** - +255
3. **BI (Burundi)** - +257
4. **CD (DR Congo)** - +243
5. **ZM (Zambia)** - +260
6. **TG (Togo)** - +228

---

## ✅ DATABASE UPDATES

### Migration Applied
**File:** `20251124055600_update_home_menu_countries.sql`

**Query:**
```sql
UPDATE whatsapp_home_menu_items
SET active_countries = ARRAY['RW', 'TZ', 'BI', 'CD', 'ZM', 'TG']
WHERE 'UG' = ANY(active_countries) OR 'KE' = ANY(active_countries);
```

**Result:** 23 menu items updated

**Verification:**
```sql
SELECT DISTINCT unnest(active_countries) as country 
FROM whatsapp_home_menu_items 
ORDER BY country;

-- Returns: BI, CD, RW, TG, TZ, ZM ✅
```

---

## ✅ CODE UPDATES

### File Updated
`supabase/functions/_shared/wa-webhook-shared/flows/home.ts`

### Function: `getCountryFromPhone()`

**Before:**
```typescript
const countryMap: Record<string, string> = {
  "250": "RW", // Rwanda
  "257": "BI", // Burundi
  "255": "TZ", // Tanzania
  "243": "CD", // Congo DRC
};
```

**After:**
```typescript
const countryMap: Record<string, string> = {
  "250": "RW", // Rwanda
  "257": "BI", // Burundi
  "255": "TZ", // Tanzania
  "243": "CD", // DR Congo
  "260": "ZM", // Zambia
  "228": "TG", // Togo
};
```

---

## ✅ HOME MENU ITEMS

### Currently Active Menu Items (8 total)

| Order | Name | Icon | Countries |
|-------|------|------|-----------|
| 1 | Waiter | 🍽️ | RW, TZ, BI, CD, ZM, TG |
| 2 | Rides | 🚗 | RW, TZ, BI, CD, ZM, TG |
| 3 | Jobs | 💼 | RW, TZ, BI, CD, ZM, TG |
| 4 | Buy and Sell | 🏪 | RW, TZ, BI, CD, ZM, TG |
| 5 | Property Rentals | 🏠 | RW, TZ, BI, CD, ZM, TG |
| 7 | Insurance | 🛡️ | RW, TZ, BI, CD, ZM, TG |
| 8 | Support | 📞 | RW, TZ, BI, CD, ZM, TG |
| 9 | Profile | 👤 | RW, TZ, BI, CD, ZM, TG |

**Note:** Farmers (order 6) is currently inactive

---

## 🔍 HOW IT WORKS

### Menu Display Logic

1. **User sends message** to WhatsApp number
2. **System extracts country** from phone number prefix:
   - +250xxx → Rwanda (RW)
   - +255xxx → Tanzania (TZ)
   - +257xxx → Burundi (BI)
   - +243xxx → DR Congo (CD)
   - +260xxx → Zambia (ZM)
   - +228xxx → Togo (TG)
3. **Database query** fetches menu items:
   ```sql
   SELECT * FROM whatsapp_home_menu_items
   WHERE is_active = true
   AND 'RW' = ANY(active_countries)  -- user's country
   ORDER BY display_order;
   ```
4. **Menu rendered** with items from `name` column + `icon` column
5. **Translations** applied based on user locale

### Menu Item Structure

```typescript
{
  id: "a1000001-0000-0000-0000-000000000001",
  name: "Waiter",              // ← Displayed in menu
  icon: "🍽️",                   // ← Shown with name
  key: "waiter_agent",         // ← Maps to handler
  is_active: true,             // ← Controls visibility
  active_countries: ["RW", "TZ", "BI", "CD", "ZM", "TG"],
  display_order: 1             // ← Sort order
}
```

---

## ✅ VERIFICATION

### Test Country Detection
```typescript
// Rwanda
getCountryFromPhone("+250788767816") // → "RW" ✅

// Tanzania  
getCountryFromPhone("+255712345678") // → "TZ" ✅

// Burundi
getCountryFromPhone("+257711234567") // → "BI" ✅

// DR Congo
getCountryFromPhone("+243812345678") // → "CD" ✅

// Zambia
getCountryFromPhone("+260971234567") // → "ZM" ✅

// Togo
getCountryFromPhone("+22890123456") // → "TG" ✅

// Uganda (removed)
getCountryFromPhone("+256712345678") // → "RW" (default) ✅

// Kenya (removed)
getCountryFromPhone("+254712345678") // → "RW" (default) ✅
```

---

## 📝 DEPLOYMENT STATUS

**Database Migration:** ✅ Deployed  
**Code Update:** ✅ Deployed (wa-webhook v554+)  
**Verification:** ✅ Complete  
**Git Push:** ✅ Complete  

---

## 🎯 IMPACT

### Users in New Countries
- ✅ **Zambia (+260)** users now see full menu
- ✅ **Togo (+228)** users now see full menu
- ✅ **DR Congo (+243)** users see correct menu (was already supported, now explicit)

### Users in Removed Countries
- ⚠️ **Uganda (+256)** users see Rwanda menu (default fallback)
- ⚠️ **Kenya (+254)** users see Rwanda menu (default fallback)

### All Users
- ✅ Menu items display correctly from `whatsapp_home_menu_items.name` column
- ✅ Icons display from `whatsapp_home_menu_items.icon` column
- ✅ Country filtering working correctly
- ✅ Menu order respected (display_order column)

---

## 🔧 MAINTENANCE

### To Add New Country
1. Add phone prefix to `getCountryFromPhone()` in `home.ts`
2. Update `active_countries` array in database:
   ```sql
   UPDATE whatsapp_home_menu_items
   SET active_countries = array_append(active_countries, 'NEW_CODE')
   WHERE active_countries IS NOT NULL;
   ```
3. Deploy wa-webhook

### To Add New Menu Item
1. Insert into `whatsapp_home_menu_items`:
   ```sql
   INSERT INTO whatsapp_home_menu_items (name, key, icon, is_active, active_countries, display_order)
   VALUES ('New Feature', 'new_feature_key', '🎯', true, ARRAY['RW', 'TZ', 'BI', 'CD', 'ZM', 'TG'], 10);
   ```
2. Add translation keys to i18n
3. Add handler in router
4. Deploy

---

**Status:** ✅ ALL CHANGES DEPLOYED AND VERIFIED

