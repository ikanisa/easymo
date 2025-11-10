# Repository Cleanup Plan

## Features to Remove

### 1. Baskets (REMOVE)
- Home menu item
- All basket flows and handlers
- Database references (if any)

### 2. Vouchers (REMOVE)
- Admin voucher flows
- Voucher handlers
- Database references

### 3. Motor Insurance (REMOVE - or keep?)
- Need to confirm if this should stay

### 4. MOMO QR (REMOVE - or keep?)
- Need to confirm if this should stay

### 5. Wallet/Tokens (REMOVE - or keep?)
- Need to confirm if this should stay

## Clean Home Menu

Keep only:
- ✅ See Drivers (AI-powered)
- ✅ See Passengers (traditional)
- ✅ Schedule Trip (traditional, AI in future)
- ✅ Nearby Pharmacies (AI-powered)
- ✅ Nearby Quincailleries (AI-powered)
- ✅ Property Rentals (AI-powered)
- ✅ Marketplace/Shops (traditional)
- ✅ Bars & Restaurants (traditional, AI waiter in future)
- ❓ Motor Insurance (confirm)
- ❓ MOMO QR (confirm)
- ❓ Wallet (confirm)

## Action Items

1. Remove BASKETS from home menu
2. Remove VOUCHERS from admin flows
3. Clean up unused imports
4. Remove basket-related state handlers
5. Remove voucher-related state handlers
6. Update documentation

---

Starting with conservative cleanup: REMOVE ONLY Baskets and Vouchers
