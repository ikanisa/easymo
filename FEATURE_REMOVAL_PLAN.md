# Feature Removal Plan: Baskets, Vouchers, Marketplace

## Context
Removing non-mobility features to focus on **WhatsApp AI-agent-first for mobility/trips only**.

## Features to Remove

### 1. Baskets (Ride-sharing baskets)
- Database tables and migrations
- WhatsApp flows
- Admin UI pages
- API routes
- Documentation

### 2. Vouchers (Fuel vouchers, tokens)
- Edge functions (ai-create-voucher, ai-redeem-voucher, ai-void-voucher)
- WhatsApp voucher flows
- Admin voucher management
- Database migrations
- Token management UI

### 3. Marketplace (Vendors, buyers, attribution)
- **5 Microservices:**
  - services/vendor-service/
  - services/buyer-service/
  - services/ranking-service/
  - services/attribution-service/
  - services/wallet-service/
- WhatsApp marketplace domain
- Admin marketplace UI
- Database tables

## Files to Remove

### A. Microservices (5 services - ~2MB)
- services/vendor-service/
- services/buyer-service/
- services/ranking-service/
- services/attribution-service/
- services/wallet-service/

### B. Edge Functions (4 functions)
- supabase/functions/ai-create-voucher/
- supabase/functions/ai-redeem-voucher/
- supabase/functions/ai-void-voucher/
- supabase/functions/baskets-reminder/

### C. WhatsApp Webhook Domains (3 domains)
- supabase/functions/wa-webhook/domains/marketplace/
- supabase/functions/wa-webhook/domains/vendor/
- supabase/functions/wa-webhook/domains/wallet/

### D. WhatsApp Flows
- supabase/functions/wa-webhook/flows/baskets.ts
- supabase/functions/wa-webhook/flows/admin/vouchers.ts
- supabase/functions/wa-webhook/flows/json/flow.admin.vouchers.v1.json
- supabase/functions/wa-webhook/flows/json/flow.admin.marketplace.v1.json
- supabase/functions/wa-webhook/exchange/admin/vouchers.ts
- supabase/functions/wa-webhook/exchange/admin/marketplace.ts
- supabase/functions/wa-webhook/rpc/marketplace.ts

### E. Admin App UI (Pages & APIs)
- admin-app/app/(panel)/baskets/
- admin-app/app/(panel)/vouchers/
- admin-app/app/(panel)/marketplace/
- admin-app/app/(panel)/campaigns/
- admin-app/app/api/baskets/
- admin-app/app/api/vouchers/
- admin-app/app/api/marketplace/
- admin-app/app/api/campaigns/
- admin-app/app/api/admin/vouchers/
- admin-app/lib/baskets/
- admin-app/lib/vouchers/
- admin-app/lib/flow-exchange/admin-vouchers.ts
- admin-app/lib/admin/admin-vouchers-service.ts
- admin-app/lib/queries/baskets.ts
- admin-app/lib/queries/vouchers.ts
- admin-app/lib/queries/marketplace.ts

### F. Legacy PWA Pages
- src/pages/Baskets.tsx
- src/pages/Marketplace.tsx
- src/pages/tokens/
- src/lib/marketplaceApi.ts

### G. Tests
- tests/api/integration/baskets-create.integration.test.ts
- admin-app/tests/basket-create-route.test.ts
- admin-app/tests/voucher-generate-route.test.ts
- admin-app/tests/e2e/vouchers-page.test.tsx

### H. Documentation
- docs/baskets-architecture.md
- docs/dual_constraint_matching_and_baskets.md
- docs/dual-constraint-matching-and-basket-readme.md

### I. Database Migrations (DO NOT DELETE - Mark as disabled)
- Move to supabase/migrations/_disabled/basket_*.sql
- Move to supabase/migrations/_disabled/voucher_*.sql
- Move to supabase/migrations/_disabled/marketplace_*.sql

## Estimated Impact
- Files to remove: ~200+ files
- Services removed: 5 microservices
- Edge functions: 4 functions
- Size freed: ~3-5MB tracked code

## Execution Order
1. Backup first
2. Remove microservices
3. Remove edge functions
4. Remove WhatsApp domains
5. Remove admin UI
6. Remove legacy PWA pages
7. Remove tests
8. Remove documentation
9. Disable (don't delete) migrations
10. Update workspace configuration
11. Verify build & tests
12. Commit & push

