# Mobility Webhook Refactor - Complete Summary

## Overview
Complete refactor of `wa-webhook-mobility` to implement a simple, clean flow for ride matching.

## New Simple Flow

### 1. User Chooses "Ride" from Home Menu
- User clicks "ride" button or sends text "ride"/"rides"/"mobility"
- System checks if user has `mobility_role` set in profile

### 2. First Time: Role Selection
- If no role set, user is asked: "Are you a driver or passenger?"
- User selects:
  - 🚗 Driver
  - 👤 Passenger
- Role is saved to `profiles.mobility_role` (persistent)

### 3. Location Sharing
- User is prompted: "Please share your current location 📍"
- User shares location via WhatsApp
- Location is saved to `trips` table with:
  - `user_id`
  - `phone`
  - `role` (from profile)
  - `pickup_lat`, `pickup_lng`
  - `vehicle_type` (default: "car")
  - `status` = "open"
  - `expires_at` = 30 minutes from now

### 4. List View of Matches
- System finds opposite role users (top 10):
  - If user is **driver** → shows **passengers**
  - If user is **passenger** → shows **drivers**
- Simple query: `trips` table filtered by:
  - Opposite role
  - Status = "open"
  - Not expired
  - Not own trips
  - Ordered by `created_at` DESC
  - Limit 10
- List view shows:
  - Name (from profile or phone)
  - Reference code
  - Estimated distance/time

## Database Changes

### Migration: `20251216130000_add_mobility_role_to_profiles.sql`
- Added `mobility_role` column to `profiles` table
- Type: `TEXT CHECK (mobility_role IN ('driver', 'passenger'))`
- Indexed for fast lookups
- Persistent role stored per user

## Code Changes

### Deleted Files
- `handlers/schedule.ts` - Complex scheduling logic
- `handlers/nearby.ts` - Complex nearby matching
- `handlers/go_online.ts` - Go online/offline flow
- `handlers/menu.ts` - Complex menu handling
- `handlers/schedule/booking.ts` - Schedule booking
- `handlers/schedule/management.ts` - Schedule management
- `handlers/schedule.test.ts` - Schedule tests
- `handlers/nearby.test.ts` - Nearby tests
- `handlers/subscription.ts` - Subscription logic
- `handlers/vehicle_plate.ts` - Vehicle plate handling
- `handlers/agent_quotes.ts` - Agent quotes

### Simplified Files
- `index.ts` - Complete rewrite with simple flow
- `handlers/index.ts` - Simplified (no longer using lazy loading)

### Key Features
- **No complex state management** - Flow is implicit based on user's role
- **Simple database queries** - Direct queries, no complex RPC functions
- **Clean code** - All logic in one file for easy maintenance
- **Persistent roles** - User's role stored in profile, not per-trip

## Button IDs Used

```typescript
const BUTTON_IDS = {
  RIDE: "ride",
  DRIVER: "driver",
  PASSENGER: "passenger",
} as const;
```

## Text Triggers

Users can trigger the flow with:
- "rides"
- "rides_agent"
- "ride"
- "mobility"
- "transport"
- "taxi"
- "menu"

## Deployment

- ✅ Migration applied: `mobility_role` column added
- ✅ Function deployed: `wa-webhook-mobility` v3.0.0
- ✅ `verify_jwt = false` confirmed in `function.json`

## Testing Checklist

- [ ] User selects "ride" for first time → role selection shown
- [ ] User selects driver → role saved, location prompt shown
- [ ] User selects passenger → role saved, location prompt shown
- [ ] User shares location → trip created, matches shown
- [ ] Driver sees list of passengers
- [ ] Passenger sees list of drivers
- [ ] Second time user selects "ride" → goes directly to location prompt
- [ ] No matches found → appropriate message shown

## Next Steps (Optional Enhancements)

1. **Distance Calculation**: Implement proper Haversine distance calculation
2. **ETA Calculation**: Calculate actual ETA based on distance
3. **Vehicle Type Selection**: Allow users to select vehicle type
4. **Location Caching**: Cache user's last location for faster matching
5. **Notifications**: Notify users when matches are found
6. **Contact Integration**: Direct WhatsApp contact from list view

## Notes

- All complex flows (scheduling, nearby matching, go online/offline) have been removed
- The system is now much simpler and easier to maintain
- Role is persistent per user, not per trip
- Location is saved to `trips` table for matching
- Top 10 matches shown in list view

