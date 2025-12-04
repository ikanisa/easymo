# Vehicle Management Implementation - Complete Fix

## Overview
This document describes the complete refactoring of the vehicle management workflow in wa-webhook-profile microservice. The previous implementation incorrectly referenced an "AI Agent" that doesn't exist. The new implementation provides a straightforward, user-friendly flow for adding vehicles via insurance certificate OCR.

## Problem Statement
### Issues Fixed
1. **No AI Agent**: References to `IDS.INSURANCE_AGENT` were incorrect - there's no AI agent for vehicle management
2. **Wrong Database Table**: Used `insurance_profiles` instead of proper `vehicles` + `vehicle_ownerships` tables
3. **No OCR Integration**: Vehicle addition didn't leverage the existing `insurance-ocr` function
4. **Poor User Experience**: Users were confused by references to non-existent AI agents
5. **Missing Validation**: No insurance expiry validation or document verification

## Solution Architecture

### Database Schema
```sql
-- Vehicles table (master registry)
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_plate TEXT UNIQUE NOT NULL,
  make TEXT,
  model TEXT,
  vehicle_year INTEGER,
  vin_chassis TEXT UNIQUE,
  color TEXT,
  capacity INTEGER,
  vehicle_type TEXT,
  status TEXT DEFAULT 'active'
);

-- Vehicle ownership tracking
CREATE TABLE public.vehicle_ownerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id),
  user_id UUID REFERENCES profiles(user_id),
  insurance_certificate_id UUID REFERENCES driver_insurance_certificates(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT TRUE
);

-- Insurance certificates
CREATE TABLE public.driver_insurance_certificates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id),
  vehicle_id UUID REFERENCES vehicles(id),
  vehicle_plate TEXT,
  insurer_name TEXT,
  policy_number TEXT,
  policy_expiry DATE,
  status TEXT DEFAULT 'pending',
  media_url TEXT
);
```

### User Flow

#### 1. List Vehicles
**Trigger**: User taps "My Vehicles" from profile menu
**Action**: 
- If no vehicles: Show "Add Vehicle" button with clear instructions
- If has vehicles: Show list with plate numbers, make/model, insurance status

#### 2. Add Vehicle
**Trigger**: User taps "Add Vehicle" or sends insurance document
**Flow**:
```
1. User taps "Add Vehicle"
2. System prompts: "Send photo/PDF of insurance certificate"
3. User uploads insurance document (image or PDF)
4. System processes via insurance-ocr function
5. System validates:
   - Document is readable (OCR confidence)
   - Plate number is extracted
   - Insurance is not expired
   - All required fields present
6. System creates/updates vehicle record
7. System creates vehicle ownership
8. System sends success message with vehicle details
```

#### 3. View Vehicle Details
**Trigger**: User taps on a vehicle from list
**Display**:
- Vehicle plate number
- Make, model, year
- Color, VIN (if available)
- Insurance status with expiry date
- Warning if insurance is expired or expiring soon

#### 4. Insurance Expiry Handling
**Scenarios**:
- **Expired**: Shows "⚠️ EXPIRED" with renewal button
- **Expiring Soon (≤30 days)**: Shows warning with days remaining
- **Active**: Shows "✅ Active" with expiry date

### Implementation Files

#### 1. `/supabase/functions/wa-webhook-profile/vehicles/add.ts`
New file containing:
- `startAddVehicle()`: Initiates vehicle addition flow
- `handleVehicleInsuranceUpload()`: Processes insurance certificate upload

**Key Features**:
- Uses `insurance-ocr` function for document extraction
- Validates insurance expiry date
- Checks for duplicate media uploads
- Creates vehicle + ownership + certificate records atomically
- Provides clear error messages for common failure scenarios

#### 2. `/supabase/functions/wa-webhook-profile/vehicles/list.ts`
Updated to:
- Query `vehicle_ownerships` table instead of `insurance_profiles`
- Join with `vehicles` and `driver_insurance_certificates` tables
- Display insurance expiry status
- Show "Add Vehicle" button instead of "AI Agent"
- Provide insurance renewal option for expired/expiring vehicles

#### 3. `/supabase/functions/wa-webhook-profile/index.ts`
Updated to:
- Handle `ADD_VEHICLE` button click
- Handle `RENEW_INSURANCE` button click
- Route insurance document uploads to `handleVehicleInsuranceUpload()`
- Manage `vehicle_add_insurance` state

## User Messages

### Success Flow
```
User: *taps "My Vehicles"*
System: 🚗 You don't have any registered vehicles yet.

To add a vehicle, simply send us a photo or PDF of your 
valid insurance certificate (Yellow Card).

We'll automatically extract the vehicle details and 
register it for you!

[➕ Add Vehicle] [← Back]

User: *taps "Add Vehicle"*
System: 🚗 Add Vehicle

To add your vehicle, please send a photo or PDF of your 
valid insurance certificate (Yellow Card).

📋 The system will automatically extract:
• Vehicle registration plate
• Insurance policy number
• Insurance company name
• Policy expiry date

⚠️ Important: Your insurance must be valid (not expired).

[← Cancel]

User: *uploads insurance certificate image*
System: ⏳ Processing your insurance certificate...

This may take a few seconds.

System: ✅ Vehicle Added Successfully!

🚗 Plate Number: RAB 123 A
🏢 Insurance Company: SORAS
📄 Policy Number: POL-2024-12345
📅 Insurance Expires: 31/12/2025

Your vehicle is now registered and ready to use for rides!

[📋 View My Vehicles] [← Back to Profile]
```

### Error Scenarios

#### 1. Expired Insurance
```
⚠️ Insurance certificate is expired!

Plate: RAB 123 A
Expiry Date: 15/01/2024

Please upload a valid (non-expired) insurance certificate 
to add your vehicle.

[🔄 Upload Valid Certificate] [← Back]
```

#### 2. Unreadable Document
```
⚠️ Unable to read the document automatically.

Your document has been queued for manual review. Our team 
will process it shortly and notify you.

Please ensure:
• The image is clear and well-lit
• All text is readable
• The document is a valid insurance certificate

[📋 My Vehicles] [← Back]
```

#### 3. Missing Plate Number
```
⚠️ Could not find vehicle plate number.

Please make sure the document clearly shows the vehicle 
registration plate and try again.

[🔄 Try Again] [← Back]
```

## OCR Integration

### insurance-ocr Function
The vehicle addition leverages the existing `insurance-ocr` edge function:

**Endpoint**: `supabase/functions/insurance-ocr`
**Input**:
```json
{
  "inline": {
    "signedUrl": "https://...",
    "mime": "image/jpeg"
  }
}
```

**Output**:
```json
{
  "raw": { /* raw OCR response */ },
  "normalized": {
    "vehicle_plate": "RAB 123 A",
    "policy_number": "POL-2024-12345",
    "insurer_name": "SORAS",
    "policy_expiry": "2025-12-31",
    "make": "Toyota",
    "model": "Corolla",
    "year": 2020,
    "vin_chassis": "JT2BK12E7V0123456"
  }
}
```

### OCR Providers
Supports both:
1. **OpenAI GPT-4o Vision** (primary)
2. **Google Gemini Vision** (fallback)

Configuration via environment variables:
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

## Database Operations

### 1. Upsert Vehicle
```sql
SELECT upsert_vehicle(
  p_plate := 'RAB 123 A',
  p_make := 'Toyota',
  p_model := 'Corolla',
  p_year := 2020,
  p_vin := 'JT2BK12E7V0123456',
  p_vehicle_type := 'car'
) -- Returns vehicle_id
```

### 2. Create Ownership
```sql
SELECT create_vehicle_ownership(
  p_vehicle_id := '...',
  p_user_id := '...',
  p_certificate_id := '...'
)
```

### 3. Query User Vehicles
```sql
SELECT 
  vo.id,
  vo.vehicle_id,
  v.registration_plate,
  v.make,
  v.model,
  v.vehicle_year,
  dic.policy_expiry,
  dic.insurer_name,
  dic.status
FROM vehicle_ownerships vo
JOIN vehicles v ON v.id = vo.vehicle_id
LEFT JOIN driver_insurance_certificates dic ON dic.id = vo.insurance_certificate_id
WHERE vo.user_id = '<user_id>'
  AND vo.is_current = TRUE
ORDER BY vo.created_at DESC;
```

## State Management

### States Used
1. `vehicle_add_insurance`: User is in vehicle addition flow, waiting for document upload
2. `home`: Default state, user can start vehicle addition

### State Transitions
```
home 
  → [User taps "Add Vehicle"] 
  → vehicle_add_insurance 
  → [User uploads document] 
  → (processing) 
  → home (success/failure)
```

## Security & Validation

### 1. Document Validation
- ✅ Media ID uniqueness (prevents duplicate processing)
- ✅ File type validation (image/PDF only)
- ✅ OCR confidence check
- ✅ Required field extraction (plate number mandatory)

### 2. Insurance Validation
- ✅ Policy expiry date check
- ✅ Date parsing and validation
- ✅ Warning for expiring insurance (≤30 days)
- ✅ Blocking of expired insurance

### 3. User Authorization
- ✅ Profile ID verification
- ✅ Vehicle ownership verification
- ✅ RLS policies on all tables

## Error Handling

### Idempotency
- Duplicate media uploads are detected and skipped
- Vehicle upsert handles existing plates gracefully
- Insurance leads can be reused within 15-minute window

### Fallback Mechanisms
1. **OCR Failure**: Queue for manual review
2. **Missing Fields**: Clear error message with retry option
3. **Network Issues**: Graceful degradation with user notification

### Logging
All operations log structured events:
- `VEHICLE_ADD_STARTED`
- `VEHICLE_OCR_FAILED`
- `VEHICLE_ADDED_SUCCESS`
- `VEHICLE_ADD_ERROR`

## Testing Checklist

### Manual Testing
- [ ] User can view empty vehicles list
- [ ] User can tap "Add Vehicle" button
- [ ] User receives clear upload instructions
- [ ] User can upload image of insurance certificate
- [ ] System shows processing message
- [ ] System extracts vehicle details correctly
- [ ] System validates insurance expiry
- [ ] System creates vehicle record
- [ ] System creates ownership record
- [ ] User receives success message with details
- [ ] User can view vehicle in list
- [ ] User can tap vehicle to see details
- [ ] Expired insurance shows warning
- [ ] Renewal button appears for expired insurance
- [ ] Error messages are clear and actionable

### Edge Cases
- [ ] Expired insurance certificate → Rejected with clear message
- [ ] Unreadable document → Queued for manual review
- [ ] Missing plate number → Error with retry option
- [ ] Duplicate upload → Skipped silently
- [ ] Network timeout → Graceful error
- [ ] Invalid file type → Clear rejection
- [ ] Multiple vehicles → All show in list
- [ ] Insurance expiring soon → Warning displayed

## Deployment Steps

1. **Database Migration**: Already deployed (20251203080000_insurance_system_fixes.sql)
2. **Deploy Updated Functions**:
   ```bash
   supabase functions deploy wa-webhook-profile
   ```
3. **Verify Environment Variables**:
   - `OPENAI_API_KEY` or `GEMINI_API_KEY` (at least one required)
   - `INSURANCE_MEDIA_BUCKET` (default: "insurance-docs")
   - `WHATSAPP_APP_SECRET`
4. **Test Flow**: Send test insurance certificate from WhatsApp

## Monitoring

### Key Metrics
- Vehicle additions per day
- OCR success rate
- Insurance expiry warnings sent
- Manual review queue length
- Average processing time

### Alerts
- OCR failure rate > 20%
- Manual review queue > 50 items
- No vehicle additions in 24 hours (if expected traffic)

## Future Enhancements

1. **Vehicle Deletion**: Allow users to remove vehicles
2. **Vehicle Editing**: Update vehicle details manually
3. **Multiple Insurance Providers**: Support multiple insurance companies per vehicle
4. **Insurance Renewal Reminders**: Automated reminders 30, 7, 1 days before expiry
5. **Vehicle Photos**: Allow users to upload vehicle photos
6. **Verification Badge**: Show verified status for manually reviewed vehicles
7. **Insurance History**: Track previous insurance certificates
8. **Export Feature**: Generate PDF report of vehicle details

## References

- Database Schema: `supabase/migrations/20251203080000_insurance_system_fixes.sql`
- Insurance OCR: `supabase/functions/insurance-ocr/index.ts`
- Vehicle Add Handler: `supabase/functions/wa-webhook-profile/vehicles/add.ts`
- Vehicle List Handler: `supabase/functions/wa-webhook-profile/vehicles/list.ts`
- Main Router: `supabase/functions/wa-webhook-profile/index.ts`
