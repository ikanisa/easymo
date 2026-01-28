---
description: "Improve matching quality and reduce vendor spam by introducing a lightweight product taxonomy and inventory tagging. Enables precise vendor filtering."
---

# Workflow 16 — Product Taxonomy + Vendor Inventory Tags

## Goal
Stop "spray and pray" vendor outreach:
- Normalize client needs into taxonomy
- Let vendors tag inventory capabilities
- Filter vendors before messaging

Result: fewer pings, faster shortlists, happier vendors.

## Outputs
1) Minimal taxonomy spec
2) Supabase tables for inventory tags
3) Normalization rules
4) Vendor tagging approach
5) Tests for matching accuracy

## Step 1 — Define taxonomy v1
Create `docs/taxonomy/taxonomy.v1.md`:

Initial categories:
- `electronics` → `phone_accessories` (brand, model, accessory_type, color)
- `pharmacy` → `prescription_meds` (drug_name, form, dose), `otc`
- `groceries`
- `cosmetics`
- `hardware`

**Keep v1 tiny and practical.**

## Step 2 — Add inventory tagging table
Create `supabase/migrations/0005_moltbot_inventory_tags.sql`:

Table: `vendor_inventory_tags`
- `id uuid`, `vendor_id uuid`
- `category text`, `tag text`
- `brand text`, `model text`
- `price_min int`, `price_max int`
- `updated_at timestamptz`

Indexes:
- `(category, tag)`
- `(vendor_id, category)`

## Step 3 — Normalization rules
Create `src/taxonomy/normalizeNeed.ts`:

Inputs: client text, OCR fields

Outputs:
- `category`, `subcategory`, `attributes`
- `query_string` (for vendor message)

Rules:
- Phone case detection: "iphone" → electronics/phone_accessories
- Prescription: → pharmacy/prescription_meds
- If uncertain: return `unknown`, trigger `ask_client`

## Step 4 — Vendor matching function
Update `marketplace.search_vendors`:

1. Match vendors.categories AND/OR inventory tags
2. Prefer inventory tag matches first
3. Fall back to category-only if few results

**Never contact more than 15 vendors.**

## Step 5 — Vendor tagging approach
Create `docs/taxonomy/vendor-tagging.v1.md`:

Methods:
1. Admin dashboard form
2. Vendor WhatsApp setup: "TAG: iPhone 15 Pro case 15k-30k"
3. Bulk CSV upload

For pilot: 20–50 vendors tagged in top categories

## Step 6 — Tests
1. Known queries map to correct category
2. search_vendors returns tag-matched vendors first
3. Outreach count drops vs baseline

## Done when
- Phone case request hits tagged vendors first
- Vendor outreach volume reduced
