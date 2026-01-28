---
description: "Verified vendor vs unverified seller distinction for listings"
---

# Rule 101 — Web Listings Verification

## Seller Classification

### Unverified Seller
- Default state for anonymous listings
- `product_listings.vendor_id = NULL`
- `product_listings.is_verified_seller = false`
- Badge displayed: "Unverified seller"

### Verified Vendor
- Listing linked to verified `vendors` record
- `product_listings.vendor_id` set by admin approval
- `product_listings.is_verified_seller = true`
- Badge displayed: vendor business name

## Verification Workflow

### Request Submission
1. Anonymous seller calls `request_listing_verification`
2. Creates `listing_verification_requests` row (status: pending)
3. Seller provides:
   - `requested_vendor_name`
   - `requested_phone`
   - `requested_business_location`

### Admin Review
1. Admin reviews pending requests in dashboard
2. Options:
   - **Approve**: create/attach `vendors` record, set `vendor_id`
   - **Reject**: set status to rejected with notes
3. On approval:
   - Update `product_listings.vendor_id`
   - Set `product_listings.is_verified_seller = true`

### Constraints
- Anonymous users cannot set `vendor_id` directly
- Only admin tools can approve verification
- Verification is per-listing, not per-session

## UI Display Rules

### Vendors Tab
- Shows ONLY verified vendors (from `vendors` table)
- Never includes unverified sellers

### Listings Tab
- Shows ALL published listings
- Each card displays seller badge:
  - Verified: vendor name + optional WhatsApp link
  - Unverified: "Unverified seller" badge

### Seller Badge Format
```typescript
type SellerBadge = 
  | { kind: "verified_vendor"; vendor_name: string; whatsapp_phone?: string }
  | { kind: "unverified_seller" };
```

## Security Rules
- Never claim seller is verified unless `vendor_id` is set AND vendor is verified
- Never expose seller session_id to buyers
- Inquiry messages go through system, not direct contact
