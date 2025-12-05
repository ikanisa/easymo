# Vehicle Addition Workflow Fix - Vehicle Type Selection First

## Issue
When users add a vehicle in Rwanda, they were immediately asked to upload insurance certificate WITHOUT first selecting the vehicle type. This created confusion and didn't allow the system to properly categorize the vehicle.

**Old (Wrong) Flow:**
```
1. Tap "Add Vehicle"
2. Upload insurance certificate ❌ (type unknown!)
3. System extracts data
```

**Correct Flow:**
```
1. Tap "Add Vehicle"
2. SELECT VEHICLE TYPE (Moto, Cab, Lifan, Truck, Other) ✅
3. Upload insurance certificate
4. System extracts data with known vehicle type
```

## Solution
Added a **two-step vehicle addition workflow**:

### Step 1: Vehicle Type Selection
```typescript
export async function startAddVehicle(ctx: RouterContext): Promise<boolean> {
  await setState(ctx.supabase, ctx.profileId, {
    key: "vehicle_add_select_type",
    data: {},
  });

  await sendListMessage(ctx, {
    title: "🚗 Add Vehicle",
    body: "First, select your vehicle type:",
    sectionTitle: "Vehicle Types",
    rows: [
      { id: "veh_moto", title: "🏍️ Moto taxi", description: "Two-wheel motorcycle" },
      { id: "veh_cab", title: "🚗 Cab", description: "Standard car (4 wheels)" },
      { id: "veh_lifan", title: "🛺 Lifan", description: "Three-wheel cargo vehicle" },
      { id: "veh_truck", title: "🚚 Truck", description: "Pickup or delivery truck" },
      { id: "veh_other", title: "🚐 Other", description: "Bus, van, or other vehicle" },
    ],
    buttonText: "Select",
  });
}
```

### Step 2: Insurance Certificate Upload
```typescript
export async function handleVehicleTypeSelection(
  ctx: RouterContext,
  vehicleType: string,
): Promise<boolean> {
  await setState(ctx.supabase, ctx.profileId, {
    key: "vehicle_add_insurance",
    data: { vehicleType }, // Store selected type
  });

  await sendButtonsMessage(
    ctx,
    `🚗 *Add ${vehicleName}*\n\n` +
    "Please send a photo or PDF of your valid insurance certificate...",
    [{ id: IDS.MY_VEHICLES, title: "← Cancel" }],
  );
}
```

### Step 3: Process Upload with Vehicle Type
```typescript
export async function handleVehicleInsuranceUpload(
  ctx: RouterContext,
  message: RawWhatsAppMessage,
  state: any,
): Promise<boolean> {
  // Get vehicle type from state
  const vehicleType = state?.data?.vehicleType || "veh_other";
  
  // ... OCR processing ...
  
  // Use the vehicle type when creating vehicle record
  await ctx.supabase.rpc("upsert_vehicle", {
    p_plate: plateNumber,
    p_vehicle_type: vehicleType, // ✅ Known vehicle type!
  });
}
```

## User Experience

### Before
```
User: [Taps "Add Vehicle"]
System: "Send insurance certificate"
User: [Confused - which vehicle type?]
```

### After
```
User: [Taps "Add Vehicle"]
System: "First, select your vehicle type:"
       🏍️ Moto taxi
       🚗 Cab
       🛺 Lifan
       🚚 Truck
       🚐 Other
User: [Selects "🏍️ Moto taxi"]
System: "Add Moto taxi - Please send insurance certificate"
User: [Uploads certificate]
System: "✅ Moto taxi Added Successfully!"
```

## Files Changed
1. `supabase/functions/wa-webhook-profile/vehicles/add.ts`
   - Split `startAddVehicle()` into vehicle type selection
   - Added `handleVehicleTypeSelection()` handler
   - Updated `handleVehicleInsuranceUpload()` to accept state and use vehicle type
   - Added import for `sendListMessage`

2. `supabase/functions/wa-webhook-profile/index.ts`
   - Added handler for vehicle type selection (`veh_*` IDs)
   - Updated insurance upload handler to pass state
   - Added state check for `vehicle_add_select_type`

## State Flow
```
State Key: vehicle_add_select_type
  ↓ (user selects veh_moto)
State Key: vehicle_add_insurance
State Data: { vehicleType: "veh_moto" }
  ↓ (user uploads certificate)
Vehicle Created: { plate: "RAH815J", type: "veh_moto" }
  ↓
State Cleared
```

## Vehicle Types
- `veh_moto` - Moto taxi (motorcycle)
- `veh_cab` - Cab (standard car)
- `veh_lifan` - Lifan (3-wheel cargo)
- `veh_truck` - Truck (pickup/delivery)
- `veh_other` - Other (bus, van, etc.)

## Benefits
✅ **Clear workflow** - Users know exactly what to do  
✅ **Correct categorization** - Vehicle type known before upload  
✅ **Better UX** - Guided step-by-step process  
✅ **Data quality** - No guessing vehicle type from OCR  
✅ **Scalable** - Easy to add more vehicle types  

## Testing
1. Tap "Add Vehicle"
2. Verify: Should show vehicle type selection list
3. Select "Moto taxi"
4. Verify: Should ask for insurance certificate with "Add Moto taxi" title
5. Upload certificate
6. Verify: Vehicle created with correct type

## Deployment
```bash
supabase functions deploy wa-webhook-profile --no-verify-jwt
```

**Status**: ✅ Deployed (2025-12-05)

## Rwanda Context
In Rwanda, proper vehicle classification is critical for:
- Insurance verification
- Regulatory compliance
- Driver matching (passengers expect specific vehicle types)
- Fare calculation (different rates for moto vs cab)
