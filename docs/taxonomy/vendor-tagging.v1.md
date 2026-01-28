# Vendor Tagging Approach v1

How vendors tag their inventory capabilities for taxonomy-based matching.

---

## Tagging Methods

### 1. Admin Dashboard Form

**Primary method for pilot (20–50 vendors)**

Admin enters tags via structured form:
- Select category (dropdown)
- Select subcategory (dropdown)
- Enter brand, model, price range
- Bulk add multiple tags per vendor

Example:
```
Vendor: Kimironko Electronics Shop
Category: electronics
Subcategory: phone_accessories
Tag: iphone_case
Brand: Apple
Model: iPhone 15 Pro
Price: 15,000 - 30,000 RWF
```

---

### 2. Vendor WhatsApp Self-Tag

**Message format:**
```
TAG: [product] [price_range]
```

**Examples:**
```
TAG: iPhone 15 Pro case 15k-30k
TAG: Samsung Galaxy charger 8k-12k
TAG: Panadol tablets 500
```

**Parsing rules:**
1. Detect `TAG:` prefix
2. Extract product name → normalize to `brand`, `model`, `tag`
3. Extract price range → `price_min`, `price_max`
4. Auto-categorize based on taxonomy detection triggers

**Backend handler:** Parse message, call `upsert_vendor_tag()`.

---

### 3. Bulk CSV Upload

**CSV format:**
```csv
vendor_id,category,subcategory,tag,brand,model,price_min,price_max
uuid-1,electronics,phone_accessories,iphone_case,Apple,iPhone 15 Pro,15000,30000
uuid-1,electronics,phone_accessories,charger,Apple,,8000,12000
uuid-2,pharmacy,otc,panadol,GSK,Panadol Extra,500,800
```

**Upload via admin dashboard** → parsed and bulk inserted.

---

## Pilot Plan

### Phase 1: Initial 20–50 Vendors

1. **Select pilot vendors** — top responders from outreach history
2. **Admin tags manually** — 5–10 tags per vendor for main products
3. **Train vendors** — send WhatsApp guide on self-tagging

### Phase 2: Expand Self-Tagging

1. **Send TAG guide** to all active vendors
2. **Parse incoming TAGs** automatically
3. **Admin reviews** and approves new tags

### Metrics to Track

- Tag coverage: % of vendors with ≥1 tag
- Match rate: % of requests hitting tagged vendors first
- Outreach reduction: before/after vendor ping count

---

## Tag Normalization

When parsing vendor input, normalize to canonical forms:

| Input | Normalized |
|-------|------------|
| "iphone 15 pro case" | `brand: Apple`, `model: iPhone 15 Pro`, `tag: case` |
| "samsung charger" | `brand: Samsung`, `tag: charger` |
| "panadol" | `brand: GSK`, `tag: panadol`, `category: pharmacy` |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-01-29 | Initial tagging approach |
