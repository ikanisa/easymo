# Multi-Country Vehicle Registration Implementation Plan

**Date**: 2025-12-05  
**Status**: 📋 **IMPLEMENTATION PLAN**  
**Scope**: Support mobility in RW, CD, BI, TZ with country-specific rules

## Requirements

### Supported Countries (from COUNTRIES.md)
- 🇷🇼 **RW** (Rwanda) - PRIMARY - Insurance REQUIRED
- 🇨🇩 **CD** (DR Congo) - Insurance NOT required
- 🇧🇮 **BI** (Burundi) - Insurance NOT required  
- 🇹🇿 **TZ** (Tanzania) - Insurance NOT required

### Business Rules

1. **Rwanda (RW) ONLY**: Vehicle insurance certificate required (Yellow Card OCR)
2. **Other countries**: Manual vehicle entry via WhatsApp Flow
   - User types plate number manually
   - User selects vehicle type: Moto, Taxi, Cab, Kifan, Truck, Others
3. **Insurance service**: ONLY offered in Rwanda
4. **Country detection**: From user's shared location (lat/lng → country)
5. **User profile**: Must store country code

## Database Changes

### 1. Add Country to User Profiles

```sql
-- Migration: 20251205020000_add_country_to_profiles.sql

BEGIN;

-- Add country column to user_profiles (existing table)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'RW' CHECK (country IN ('RW', 'CD', 'BI', 'TZ'));

-- Add country column to whatsapp_users (existing table)
ALTER TABLE whatsapp_users
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'RW' CHECK (country IN ('RW', 'CD', 'BI', 'TZ'));

-- Create index for country-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_country ON user_profiles(country);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_country ON whatsapp_users(country);

-- Update existing users to RW (default/primary market)
UPDATE user_profiles SET country = 'RW' WHERE country IS NULL;
UPDATE whatsapp_users SET country = 'RW' WHERE country IS NULL;

COMMIT;
```

### 2. Add Country to Vehicles Table

```sql
-- Migration: 20251205020001_add_country_to_vehicles.sql

BEGIN;

-- Add country to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'RW' CHECK (country IN ('RW', 'CD', 'BI', 'TZ'));

-- Insurance is only required for Rwanda
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS insurance_required BOOLEAN DEFAULT true;

-- Update logic: insurance required only for Rwanda
UPDATE vehicles SET insurance_required = (country = 'RW');

-- Create index
CREATE INDEX IF NOT EXISTS idx_vehicles_country ON vehicles(country);

COMMIT;
```

### 3. Create Countries Configuration Table

```sql
-- Migration: 20251205020002_create_countries_config.sql

BEGIN;

CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY CHECK (code IN ('RW', 'CD', 'BI', 'TZ')),
  name TEXT NOT NULL,
  mobility_enabled BOOLEAN DEFAULT true,
  insurance_required BOOLEAN DEFAULT false,
  insurance_service_offered BOOLEAN DEFAULT false,
  default_currency TEXT,
  phone_prefix TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert country configurations
INSERT INTO countries (code, name, mobility_enabled, insurance_required, insurance_service_offered, default_currency, phone_prefix)
VALUES
  ('RW', 'Rwanda', true, true, true, 'RWF', '+250'),
  ('CD', 'DR Congo', true, false, false, 'CDF', '+243'),
  ('BI', 'Burundi', true, false, false, 'BIF', '+257'),
  ('TZ', 'Tanzania', true, false, false, 'TZS', '+255')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  mobility_enabled = EXCLUDED.mobility_enabled,
  insurance_required = EXCLUDED.insurance_required,
  insurance_service_offered = EXCLUDED.insurance_service_offered,
  default_currency = EXCLUDED.default_currency,
  phone_prefix = EXCLUDED.phone_prefix,
  updated_at = NOW();

COMMIT;
```

## Code Changes

### 1. Country Detection from Location

**File**: `supabase/functions/_shared/wa-webhook-shared/utils/geo.ts`

```typescript
// Add reverse geocoding to get country from lat/lng
export async function getCountryFromCoords(lat: number, lng: number): Promise<string> {
  // Rwanda bounds
  if (lat >= -2.84 && lat <= -1.05 && lng >= 28.86 && lng <= 30.90) {
    return 'RW';
  }
  
  // DR Congo bounds (eastern region near Rwanda)
  if (lat >= -11.7 && lat <= 5.4 && lng >= 12.2 && lng <= 31.3) {
    return 'CD';
  }
  
  // Burundi bounds
  if (lat >= -4.47 && lat <= -2.31 && lng >= 28.99 && lng <= 30.85) {
    return 'BI';
  }
  
  // Tanzania bounds
  if (lat >= -11.75 && lat <= -0.99 && lng >= 29.33 && lng <= 40.44) {
    return 'TZ';
  }
  
  // Default to Rwanda if uncertain
  return 'RW';
}
```

### 2. Update Profile Creation to Store Country

**File**: `supabase/functions/_shared/wa-webhook-shared/utils/profile.ts`

```typescript
export async function ensureProfile(
  ctx: RouterContext,
  location?: { lat: number; lng: number }
): Promise<UserProfile | null> {
  // Detect country from location if provided
  const country = location 
    ? await getCountryFromCoords(location.lat, location.lng)
    : 'RW'; // default

  // Create/update profile with country
  const { data: profile } = await ctx.supabase
    .from('user_profiles')
    .upsert({
      user_id: ctx.profileId,
      whatsapp_number: ctx.from,
      country, // ← Store country
      // ... other fields
    })
    .select()
    .single();

  return profile;
}
```

### 3. Country-Aware Vehicle Addition

**File**: `supabase/functions/wa-webhook-profile/vehicles/add.ts`

```typescript
export async function startAddVehicle(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Get user's country
  const { data: profile } = await ctx.supabase
    .from('user_profiles')
    .select('country')
    .eq('user_id', ctx.profileId)
    .single();

  const country = profile?.country || 'RW';

  // Rwanda: Require insurance certificate upload
  if (country === 'RW') {
    await setState(ctx.supabase, ctx.profileId, {
      key: "vehicle_add_insurance",
      data: { country },
    });

    await sendButtonsMessage(
      ctx,
      "🚗 *Add Vehicle (Rwanda)*\n\n" +
      "Please send a photo of your valid insurance certificate (Yellow Card).\n\n" +
      "📋 We'll automatically extract:\n" +
      "• Vehicle registration plate\n" +
      "• Insurance details\n",
      [{ id: IDS.MY_VEHICLES, title: "← Cancel" }]
    );
    return true;
  }

  // Other countries: Manual entry via WhatsApp Flow
  await setState(ctx.supabase, ctx.profileId, {
    key: "vehicle_add_manual",
    data: { country },
  });

  await sendText(
    ctx.from,
    `🚗 *Add Vehicle (${country})*\n\n` +
    `Please enter your vehicle registration/plate number:`
  );

  return true;
}
```

### 4. Manual Vehicle Entry Handler (Non-Rwanda)

**File**: `supabase/functions/wa-webhook-profile/vehicles/manual.ts` (NEW)

```typescript
import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendListMessage, sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";

const VEHICLE_TYPES = [
  { id: "veh_moto", title: "🏍️ Moto Taxi", description: "Motorcycle taxi service" },
  { id: "veh_cab", title: "🚕 Taxi/Cab", description: "Standard car taxi" },
  { id: "veh_kifan", title: "🛺 Kifan", description: "Three-wheeler taxi" },
  { id: "veh_truck", title: "🚚 Truck", description: "Delivery truck" },
  { id: "veh_others", title: "🚗 Others", description: "Other vehicle types" },
];

export async function handleManualPlateEntry(
  ctx: RouterContext,
  plateNumber: string,
  state: { country: string }
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Validate plate number (basic - not empty)
  const plate = plateNumber.trim().toUpperCase();
  if (!plate || plate.length < 3) {
    await sendText(
      ctx.from,
      "⚠️ Invalid plate number. Please enter a valid registration number:"
    );
    return true;
  }

  // Store plate and ask for vehicle type
  await setState(ctx.supabase, ctx.profileId, {
    key: "vehicle_add_select_type",
    data: { country: state.country, plate },
  });

  await sendListMessage(ctx, {
    title: "Select Vehicle Type",
    body: `✅ Plate: ${plate}\n\nNow select your vehicle type:`,
    rows: VEHICLE_TYPES,
    buttonText: "Choose Type",
  });

  return true;
}

export async function handleVehicleTypeSelection(
  ctx: RouterContext,
  vehicleTypeId: string,
  state: { country: string; plate: string }
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Create vehicle record
  const { data: vehicleId } = await ctx.supabase.rpc("upsert_vehicle", {
    p_plate: state.plate,
    p_vehicle_type: vehicleTypeId,
    p_country: state.country,
  });

  if (!vehicleId) {
    await sendText(ctx.from, "❌ Failed to add vehicle. Please try again.");
    return true;
  }

  // Create vehicle ownership (no insurance required)
  await ctx.supabase.rpc("create_vehicle_ownership", {
    p_vehicle_id: vehicleId,
    p_user_id: ctx.profileId,
    p_certificate_id: null, // No insurance for non-RW countries
  });

  await clearState(ctx.supabase, ctx.profileId);

  const vehicleType = VEHICLE_TYPES.find(v => v.id === vehicleTypeId);

  await sendText(
    ctx.from,
    `✅ *Vehicle Added Successfully!*\n\n` +
    `🚗 *Plate Number:* ${state.plate}\n` +
    `🚙 *Type:* ${vehicleType?.title || vehicleTypeId}\n` +
    `🌍 *Country:* ${state.country}\n\n` +
    `Your vehicle is now registered!`
  );

  return true;
}
```

### 5. Update Vehicle Add Routing

**File**: `supabase/functions/wa-webhook-profile/index.ts`

```typescript
// Import manual handlers
import { 
  handleManualPlateEntry, 
  handleVehicleTypeSelection 
} from "./vehicles/manual.ts";

// In message handling section:

// Manual plate entry (text message in vehicle_add_manual state)
if (message.type === "text" && state?.key === "vehicle_add_manual") {
  const plateText = (message as any).text?.body;
  if (plateText) {
    handled = await handleManualPlateEntry(ctx, plateText, state.data as any);
  }
}

// Vehicle type selection (interactive list)
else if (message.type === "interactive" && state?.key === "vehicle_add_select_type") {
  const listId = (message.interactive as any)?.list_reply?.id;
  if (listId?.startsWith("veh_")) {
    handled = await handleVehicleTypeSelection(ctx, listId, state.data as any);
  }
}
```

### 6. Hide Insurance Menu for Non-Rwanda Users

**File**: `supabase/functions/wa-webhook-profile/profile/home.ts`

```typescript
export async function showProfileMenu(ctx: RouterContext): Promise<void> {
  // Get user country
  const { data: profile } = await ctx.supabase
    .from('user_profiles')
    .select('country')
    .eq('user_id', ctx.profileId)
    .single();

  const country = profile?.country || 'RW';
  const rows = [
    { id: "WALLET_HOME", title: "💎 Wallet & Tokens", desc: "..." },
    { id: "MOMO_QR", title: "📱 MoMo QR Code", desc: "..." },
    { id: "MY_VEHICLES", title: "🚗 My Vehicles", desc: "..." },
  ];

  // Only show insurance for Rwanda
  if (country === 'RW') {
    rows.push({
      id: "INSURANCE_HOME",
      title: "🛡️ Insurance",
      desc: "Manage vehicle insurance",
    });
  }

  await sendListMessage(ctx, {
    title: "👤 Profile",
    body: "Manage your account...",
    rows,
    buttonText: "Choose",
  });
}
```

## Implementation Steps

### Phase 1: Database (30 min)
1. ✅ Create migration files (3 migrations above)
2. ✅ Test migrations locally
3. ✅ Deploy to production

### Phase 2: Location-Based Country Detection (1 hour)
1. ✅ Add `getCountryFromCoords()` to `geo.ts`
2. ✅ Update `ensureProfile()` to store country
3. ✅ Update `recordLastLocation()` to detect country
4. ✅ Test with coordinates from each country

### Phase 3: Manual Vehicle Entry (2 hours)
1. ✅ Create `vehicles/manual.ts` with handlers
2. ✅ Update `vehicles/add.ts` to branch by country
3. ✅ Add routing in `index.ts`
4. ✅ Test manual flow (CD, BI, TZ)

### Phase 4: Country-Aware UI (1 hour)
1. ✅ Hide insurance menu for non-RW countries
2. ✅ Update vehicle list to show country
3. ✅ Add country badge in profile

### Phase 5: Testing (2 hours)
1. ✅ Test Rwanda flow (insurance OCR)
2. ✅ Test CD flow (manual entry)
3. ✅ Test BI flow (manual entry)
4. ✅ Test TZ flow (manual entry)
5. ✅ Verify country detection from GPS

## Total Effort: ~6 hours

## Files to Create/Modify

### New Files (2)
- `supabase/migrations/20251205020000_add_country_to_profiles.sql`
- `supabase/migrations/20251205020001_add_country_to_vehicles.sql`
- `supabase/migrations/20251205020002_create_countries_config.sql`
- `supabase/functions/wa-webhook-profile/vehicles/manual.ts`

### Modified Files (6)
- `supabase/functions/_shared/wa-webhook-shared/utils/geo.ts`
- `supabase/functions/_shared/wa-webhook-shared/utils/profile.ts`
- `supabase/functions/wa-webhook-profile/vehicles/add.ts`
- `supabase/functions/wa-webhook-profile/index.ts`
- `supabase/functions/wa-webhook-profile/profile/home.ts`
- `supabase/functions/wa-webhook-mobility/handlers/nearby.ts` (country-aware matching)

## Deployment Plan

```bash
# 1. Deploy migrations
supabase db push

# 2. Deploy updated functions
supabase functions deploy wa-webhook-profile --no-verify-jwt
supabase functions deploy wa-webhook-mobility --no-verify-jwt

# 3. Verify
# - Check countries table populated
# - Test vehicle add in each country
# - Verify insurance only shows for RW
```

## Testing Checklist

- [ ] Rwanda user: Insurance OCR flow works
- [ ] Congo user: Manual plate entry works
- [ ] Burundi user: Manual plate entry works
- [ ] Tanzania user: Manual plate entry works
- [ ] Country detected from location correctly
- [ ] Insurance menu hidden for non-RW users
- [ ] Vehicle listing shows country badge
- [ ] Mobility matching works across countries

---

**Ready to implement?** Reply with "proceed" to start implementation.
