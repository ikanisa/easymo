# Profile & Wallet Architecture

**Version:** 1.0.0  
**Last Updated:** 2025-11-22  
**Status:** Active

## Overview

Profile & Wallet is the **ONLY non-agent workflow** in EasyMO. It provides structured access to:

1. **MoMo QR Code** - Personal MoMo QR management
2. **Wallet & Tokens** - Balance, history, earn/use/withdraw
3. **My Stuff** - Read-only views of agent-created entities
4. **Saved Locations** - Reusable addresses for all agents

**Key Principle:** Profile displays data; agents own the creation/modification logic.

---

## 1. MoMo QR Code 💳

**Files:** `admin-app/app/profile/qr/`, `supabase/functions/qr-resolve/`  
**Tables:** `momo_accounts`, `qr_codes`

**Flow:** Display QR → Allow regeneration if needed  
**Security:** User-scoped RLS, rate-limited generation

---

## 2. Wallet & Tokens 💰

**Files:** `admin-app/app/profile/wallet/`, migrations `20251122100000_wallet_system_config.sql`  
**Tables:** `wallet_balances`, `token_transactions`, `token_earn_rules`, `token_use_rules`

### Actions

**Earn:** Complete tasks → Get tokens (e.g., 100 for profile completion)  
**Use:** Redeem tokens for benefits (e.g., 50 tokens = 500 RWF ride discount)  
**Withdraw:** Cash out to MoMo (min 1000 tokens, 5% fee)

### Business Rules
- 1 token = 1 RWF
- Max 10 transactions/day
- Withdraw min: 1000 tokens

---

## 3. My Stuff 📦

**Rule:** View in Profile; modify via agent conversation

### A. My Businesses 🏪
*Agent: Business Broker*  
**Table:** `business_listings`  
**Actions:** View details, launch agent to edit

### B. My Vehicles 🚗
*Agents: Rides, Insurance*  
**Table:** `vehicles`  
**Actions:** View, update insurance, offer rides

### C. My Properties 🏠
*Agent: Real Estate*  
**Table:** `properties`  
**Actions:** View inquiries, launch agent to modify

### D. My Job Posts 💼
*Agent: Jobs*  
**Table:** `job_listings`  
**Actions:** View applications, edit via agent

### E. My Listings 🌾
*Agent: Farmer*  
**Table:** `produce_listings`  
**Actions:** View matches, edit via agent

### F. My Policies 🛡️
*Agent: Insurance*  
**Table:** `insurance_policies`  
**Actions:** View coverage, renew via agent

### G. My Trips 🚗
*Agent: Rides*  
**Table:** `trips`  
**Actions:** View history, book again via agent

---

## 4. Saved Locations 📍

**Why:** Save once, all agents reuse it

**Example:**
```
Rides agent: "Where from?
             1️⃣ Home (Gikondo)
             2️⃣ Work (Kimihurura)
             3️⃣ Send new location"
```

**Table:**
```sql
CREATE TABLE user_saved_locations (
  user_id uuid REFERENCES whatsapp_users(id),
  label text,  -- 'home', 'work', custom
  latitude numeric,
  longitude numeric
);
```

**Agent Usage:**
```sql
-- Inside apply_intent_rides()
SELECT latitude, longitude
FROM user_saved_locations
WHERE user_id = p_user_id AND label = 'home';
```

---

## File Structure

```
admin-app/
├── app/profile/
│   ├── qr/page.tsx
│   ├── wallet/page.tsx
│   ├── my-businesses/page.tsx
│   ├── my-vehicles/page.tsx
│   ├── my-properties/page.tsx
│   ├── my-jobs/page.tsx
│   ├── my-listings/page.tsx
│   ├── my-policies/page.tsx
│   ├── my-trips/page.tsx
│   └── locations/page.tsx
└── api/
    ├── wallet/
    │   ├── balance/route.ts
    │   ├── earn/route.ts
    │   ├── use/route.ts
    │   └── withdraw/route.ts
    └── profile/
        └── locations/route.ts
```

---

## API Endpoints

### Wallet

**GET** `/api/wallet/balance` - Current balance  
**GET** `/api/wallet/transactions` - Transaction history  
**POST** `/api/wallet/earn` - Award tokens  
**POST** `/api/wallet/use` - Redeem tokens  
**POST** `/api/wallet/withdraw` - Cash out to MoMo

### Profile

**GET** `/api/profile/locations` - Saved locations list  
**POST** `/api/profile/locations` - Save new location  
**GET** `/api/profile/my-stuff` - All user entities

---

## Security

```sql
-- RLS: Users only see their own data
ALTER TABLE wallet_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallet_balances_user_read ON wallet_balances
  FOR SELECT USING (user_id = auth.uid());
```

---

## Integration with Agents

**Agents read Profile data to personalize:**

- Saved locations → No repeated "share location" requests
- Past behavior → Better predictions (usual routes, preferred categories)
- Owned entities → "Edit your listing" vs "Create new"

**Example:**
```
Real Estate agent: "Looking near:
                   1️⃣ Home
                   2️⃣ Work
                   3️⃣ Different area"
```

---

## Testing

```typescript
// Test wallet balance
test('GET /api/wallet/balance', async () => {
  const res = await fetch('/api/wallet/balance', { headers: { auth: token } });
  expect(res.json().tokenBalance).toBeGreaterThanOrEqual(0);
});

// Test saved location usage
test('Rides agent uses saved Home', async () => {
  await saveLocation(userId, 'home', { lat: -1.9536, lon: 30.1047 });
  const intent = await parseIntent(ridesAgent, "Ride from Home");
  expect(intent.extracted_params.origin).toBe('saved_location_home');
});
```

---

## Monitoring

**Key Metrics:**
- Users with saved locations: 75%
- Avg saved locations/user: 2.3
- Daily token transactions: 2,300
- Avg wallet balance: 850 tokens

---

## Future Enhancements

1. **Smart suggestions:** "Save this frequent destination?"
2. **Wallet insights:** "You could earn 200 more tokens this month"
3. **Cross-agent learning:** Share preferences between agents

---

## Conclusion

Profile & Wallet makes agents smarter:

✅ **Saved locations** → Fewer questions  
✅ **Wallet** → Unified token economy  
✅ **My Stuff** → Single view of all entities  
✅ **Agent integration** → Seamless data reuse

**Rule:** Profile displays, agents modify.

---

**See also:** `agents-map.md`, `whatsapp-pipeline.md`

**Maintainer:** Platform Team  
**Last Updated:** 2025-11-22
