# Rides/Mobility Microservice - Complete Implementation

## Overview

This document describes the complete implementation of the rides/mobility microservice, including fixes for all identified issues and new features for a robust, production-ready ride-sharing system.

## Issues Fixed

### 1. Missing Database Functions ✅
**Problem**: Code referenced `match_drivers_for_trip_v2` and `match_passengers_for_trip_v2` but these functions didn't exist in the database.

**Solution**: Created both functions in `20251124000000_fix_rides_matching_functions.sql`:
- Uses spatial queries with bounding box optimization
- Sorts by distance (Haversine formula) and recency
- Supports vehicle type filtering
- Returns top N results (default 9)

### 2. No Location Caching ✅
**Problem**: Users had to share location every time, causing friction and poor UX.

**Solution**: Implemented 30-minute location caching:
- Location saved to `profiles.last_location` with timestamp
- If < 30 minutes old, system offers "Use Saved Location" button
- Reduces repeated location sharing
- Works across all flows (nearby, schedule, go online)

### 3. No Driver Notifications ✅
**Problem**: When passengers requested drivers, drivers weren't notified proactively.

**Solution**: Implemented driver notification system:
- Finds online drivers within radius using `find_online_drivers_near_trip`
- Sends WhatsApp notifications to top 9 drivers
- Includes action buttons: "Offer Ride" and "View Details"
- Tracks notifications in `ride_requests` and `ride_notifications` tables

### 4. No Driver Response Handling ✅
**Problem**: Drivers received notifications but couldn't respond effectively.

**Solution**: Created complete driver response flow:
- "Offer Ride" button → records acceptance → notifies passenger → provides WhatsApp link
- "View Details" button → shows full trip info (distance, pickup, dropoff, time)
- Updates `ride_requests` table with response status
- Passenger gets instant notification when driver accepts

### 5. No "Go Online" Feature ✅
**Problem**: Drivers had no easy way to make themselves discoverable for ride requests.

**Solution**: Implemented Go Online/Offline feature:
- "🟢 Go Online (Driver)" button in mobility menu
- Option to use cached location or share new
- Updates `profiles.last_location` and `rides_driver_status`
- Drivers become discoverable in matching queries
- "🔴 Go Offline" to stop receiving requests

## Architecture

### Database Layer

#### Tables
- `profiles` - User profiles with `last_location` and `last_location_at` for caching
- `trips` - Trip requests (pickup, dropoff, vehicle type, role, status)
- `ride_requests` - Tracks driver notifications and responses
- `ride_notifications` - Logs all notifications sent
- `rides_driver_status` - Driver online/offline status (optional, falls back to profiles)

#### RPC Functions

**Matching Functions:**
- `match_drivers_for_trip_v2(trip_id, limit, prefer_dropoff, radius_m, window_days)`
- `match_passengers_for_trip_v2(trip_id, limit, prefer_dropoff, radius_m, window_days)`

**Location Functions:**
- `update_user_location_cache(user_id, lat, lng)` - Save location to cache
- `get_cached_location(user_id, cache_minutes)` - Get cached location if valid

**Notification Functions:**
- `find_online_drivers_near_trip(trip_id, radius_km, limit, minutes_online)` - Find online drivers
- `record_driver_notification(trip_id, passenger_id, driver_id)` - Log notification
- `record_driver_response(request_id, response_type)` - Record driver's response
- `get_notified_drivers(trip_id)` - Get all notified drivers for a trip

### Application Layer

#### Handler Modules

**nearby.ts** - Nearby drivers/passengers flows:
- `handleSeeDrivers()` - Passenger looking for nearby drivers
- `handleSeePassengers()` - Driver looking for nearby passengers
- `handleVehicleSelection()` - Vehicle type selection
- `handleNearbyLocation()` - Process location share, save to cache, notify drivers
- `handleUseCachedLocation()` - Use 30-minute cached location
- `runMatchingFallback()` - Database matching + driver notifications

**schedule.ts** - Schedule trip flow:
- `startScheduleTrip()` - Start scheduling flow
- `handleScheduleRole()` - Driver or passenger selection
- `handleScheduleLocation()` - Pickup location + caching
- `handleScheduleDropoff()` - Dropoff location
- `handleScheduleTimeSelection()` - Time selection
- Location caching integrated

**go_online.ts** - Driver online/offline:
- `startGoOnline()` - Prompt driver to share location
- `handleGoOnlineLocation()` - Process location and go online
- `handleGoOnlineUseCached()` - Use cached location to go online
- `handleGoOffline()` - Mark driver offline

**driver_response.ts** - Driver responses:
- `handleDriverOfferRide()` - Driver accepts ride request
- `handleDriverViewDetails()` - Show trip details to driver
- `routeDriverAction()` - Route button presses

#### Utility Modules

**locations/cache.ts**:
- `saveLocationToCache()` - Save to profiles.last_location
- `getCachedLocation()` - Get cached location if valid
- `hasValidCachedLocation()` - Check cache validity

**notifications/drivers.ts**:
- `findOnlineDriversForTrip()` - Find nearby online drivers
- `notifyDriver()` - Send WhatsApp notification to single driver
- `notifyMultipleDrivers()` - Notify multiple drivers (with rate limiting)
- `handleDriverResponse()` - Record driver response
- `notifyPassengerOfDriverAcceptance()` - Notify passenger when driver accepts

## User Flows

### Flow 1: Passenger Finding Driver

```
1. Passenger: Tap "Nearby Drivers" → Select vehicle type (moto/cab/lifan/truck)
2. System: Check for cached location (< 30 min)
   - If cached: Show "Use Saved Location" button
   - If not: Prompt "Share Location"
3. Passenger: Share or use cached location
4. System: 
   - Save to 30-min cache
   - Create trip record
   - Call match_drivers_for_trip_v2 → Show top 9 drivers
   - Call find_online_drivers_near_trip → Notify top 9 online drivers
5. Driver: Receives WhatsApp notification with "Offer Ride" | "View Details"
6. Driver: Taps "Offer Ride"
7. System: Record acceptance → Notify passenger
8. Passenger: Receives WhatsApp link to contact driver
9. Done! ✅
```

### Flow 2: Driver Going Online

```
1. Driver: Tap "🟢 Go Online (Driver)" in mobility menu
2. System: Check cached location
   - If cached: Show "📍 Xm ago" + "Share Current Location"
   - If not: Show "Share Current Location"
3. Driver: Choose option → Location saved
4. System: Update profiles.last_location + rides_driver_status
5. Driver: Now discoverable for passenger requests
6. When passenger nearby requests: Driver gets WhatsApp notification
7. Driver: Can "Offer Ride" or "View Details"
8. Done! ✅
```

### Flow 3: Driver Finding Passenger

```
1. Driver: Tap "Nearby Passengers"
2. System: Check vehicle plate (one-time setup)
3. Driver: Share location (or use cached)
4. System: 
   - Save to cache
   - Create trip record
   - Call match_passengers_for_trip_v2
   - Show top 9 passengers
5. Driver: Select passenger → WhatsApp chat opens
6. Done! ✅
```

### Flow 4: Schedule Trip

```
1. User: Tap "Schedule Trip" → Select role (driver/passenger)
2. User: Select vehicle type
3. User: Share pickup location (or use cached)
4. User: Optional: Share dropoff location
5. User: Select time (now, 30m, 1h, tomorrow, etc.)
6. System:
   - Save locations to cache
   - Create trip record
   - Match and show results
   - For passengers: Notify nearby drivers
7. Done! ✅
```

## API Reference

### RPC Functions

#### match_drivers_for_trip_v2

Finds nearby drivers for a passenger's trip.

```sql
SELECT * FROM match_drivers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 30
);
```

**Returns:**
- `trip_id` - Driver's trip ID
- `creator_user_id` - Driver's user ID
- `whatsapp_e164` - Driver's WhatsApp number
- `ref_code` - Trip reference code
- `distance_km` - Distance from passenger
- `drop_bonus_m` - Dropoff proximity bonus (if applicable)
- `pickup_text` - Pickup location text
- `dropoff_text` - Dropoff location text
- `matched_at` - Match timestamp
- `created_at` - Trip creation timestamp

#### match_passengers_for_trip_v2

Finds nearby passengers for a driver.

```sql
SELECT * FROM match_passengers_for_trip_v2(
  _trip_id uuid,
  _limit integer DEFAULT 9,
  _prefer_dropoff boolean DEFAULT false,
  _radius_m integer DEFAULT 10000,
  _window_days integer DEFAULT 30
);
```

**Returns:** Same structure as `match_drivers_for_trip_v2`

#### find_online_drivers_near_trip

Finds online drivers near a trip's pickup location.

```sql
SELECT * FROM find_online_drivers_near_trip(
  _trip_id uuid,
  _radius_km double precision DEFAULT 10.0,
  _limit integer DEFAULT 9,
  _minutes_online integer DEFAULT 60
);
```

**Returns:**
- `user_id` - Driver's user ID
- `whatsapp_e164` - Driver's WhatsApp number
- `distance_km` - Distance from trip pickup
- `last_location_at` - When location was last updated
- `vehicle_type` - Driver's vehicle type

#### update_user_location_cache

Saves user's location to 30-minute cache.

```sql
SELECT update_user_location_cache(
  _user_id uuid,
  _lat double precision,
  _lng double precision
);
```

#### get_cached_location

Gets user's cached location if still valid.

```sql
SELECT * FROM get_cached_location(
  _user_id uuid,
  _cache_minutes integer DEFAULT 30
);
```

**Returns:**
- `lat` - Latitude
- `lng` - Longitude
- `cached_at` - Timestamp when cached
- `is_valid` - Whether cache is still valid

## Configuration

### Environment Variables

```bash
# WhatsApp API
WA_PHONE_ID=your_phone_id
WA_TOKEN=your_access_token
WA_VERIFY_TOKEN=your_verify_token

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: HTTP retry settings
WA_HTTP_STATUS_RETRIES=2
WA_HTTP_STATUS_RETRY_DELAY_MS=400
```

### App Config (in database)

Stored in `app_config` table:
- `search_radius_km` - Default search radius (default: 10km)
- `max_results` - Maximum results to return (default: 9)

## Deployment

### 1. Deploy Database Migrations

```bash
# Using Supabase CLI
supabase db push

# Or apply specific migrations
supabase migration up 20251124000000
supabase migration up 20251124000001
```

### 2. Deploy Edge Function

```bash
supabase functions deploy wa-webhook-mobility
```

### 3. Verify Deployment

Test each workflow:
- Nearby drivers
- Nearby passengers
- Schedule trip
- Go online
- Driver notifications
- Driver responses

## Monitoring

### Key Metrics to Track

1. **Location Cache Hit Rate**: % of requests using cached location vs fresh share
2. **Driver Notification Rate**: % of passenger requests that trigger driver notifications
3. **Driver Response Rate**: % of notified drivers who respond (accept/view)
4. **Match Success Rate**: % of trips that result in successful matches
5. **Average Response Time**: Time from notification to driver response

### Log Events

The system logs these structured events:
- `LOCATION_CACHED` - Location saved to cache
- `DRIVER_WENT_ONLINE` - Driver went online
- `DRIVER_WENT_OFFLINE` - Driver went offline
- `NOTIFYING_DRIVERS` - Starting driver notification batch
- `DRIVER_NOTIFIED` - Single driver notified
- `DRIVERS_NOTIFICATION_BATCH` - Batch notification complete
- `DRIVER_ACCEPTED_RIDE` - Driver accepted ride request
- `DRIVER_VIEWED_DETAILS` - Driver viewed trip details
- `PASSENGER_NOTIFIED_DRIVER_ACCEPTED` - Passenger notified of acceptance
- `MATCHES_CALL` - Matching query initiated
- `MATCHES_RESULT` - Matching query completed
- `MATCHES_ERROR` - Matching query failed

## Testing

### Manual Testing Checklist

- [ ] **Nearby Drivers**:
  - [ ] Select vehicle type → share location → see drivers list
  - [ ] Use cached location (< 30 min) → see drivers list
  - [ ] Verify driver notifications sent
  - [ ] Tap driver → WhatsApp chat opens

- [ ] **Driver Response**:
  - [ ] Driver receives notification
  - [ ] Tap "View Details" → see trip info
  - [ ] Tap "Offer Ride" → passenger notified
  - [ ] Passenger receives acceptance message with driver contact

- [ ] **Location Caching**:
  - [ ] Share location → wait < 30 min → see "Use Saved Location" button
  - [ ] Share location → wait > 30 min → no cached option shown
  - [ ] Cached location works across different flows

- [ ] **Go Online**:
  - [ ] Tap "Go Online" → share location → success message
  - [ ] Use cached location to go online
  - [ ] Verify driver appears in passenger's nearby drivers
  - [ ] Tap "Go Offline" → verify removed from active pool

- [ ] **Nearby Passengers**:
  - [ ] Driver shares location → see passengers list
  - [ ] Use cached location → see passengers list
  - [ ] Tap passenger → WhatsApp chat opens

- [ ] **Schedule Trip**:
  - [ ] Complete flow as passenger → get driver list
  - [ ] Complete flow as driver → get passenger list
  - [ ] Location caching works in schedule flow

### Automated Tests

Run existing test suite:
```bash
pnpm test
```

## Troubleshooting

### Issue: No drivers shown despite drivers being online

**Check:**
1. Driver's `last_location_at` is within 60 minutes
2. Driver's `is_online` flag is true in `rides_driver_status`
3. Search radius is appropriate (default 10km)
4. Vehicle type matches

### Issue: Driver notifications not sent

**Check:**
1. `find_online_drivers_near_trip` returns results
2. WhatsApp API credentials are correct
3. Driver phone numbers are in E.164 format
4. Check logs for `DRIVER_NOTIFIED` events

### Issue: Cached location not working

**Check:**
1. `profiles.last_location` is not null
2. `profiles.last_location_at` is within 30 minutes
3. `get_cached_location` returns `is_valid = true`
4. User has shared location at least once

### Issue: Matching functions return no results

**Check:**
1. `trips` table has open trips with role matching request
2. Vehicle types match
3. Pickup coordinates are within radius
4. `created_at` is within window_days (default 30)
5. Spatial indexes exist and are up to date

## Performance Optimization

### Database Indexes

Ensure these indexes exist (created by migrations):
- `idx_trips_role_status_vehicle` - On (role, status, vehicle_type)
- `idx_trips_pickup_coords` - On (pickup_latitude, pickup_longitude)
- `idx_trips_created_at` - On (created_at DESC)
- `profiles_last_location_idx` - GIST index on last_location
- `profiles_last_location_at_idx` - On last_location_at

### Query Optimization

- Matching functions use bounding box filter before distance calculation
- Limit results to top 9 by default
- Use spatial queries (PostGIS) for geographic calculations
- Index on frequently queried fields

### Rate Limiting

Driver notifications include 100ms delay between messages to avoid WhatsApp rate limits.

## Future Enhancements

1. **Real-time Tracking**: Live location updates during ride
2. **Pricing**: Estimated fare calculation
3. **Payment Integration**: In-app payment processing
4. **Rating System**: Driver and passenger ratings
5. **Trip History**: View past trips
6. **Favorite Drivers**: Save preferred drivers
7. **Push Notifications**: In addition to WhatsApp
8. **Advanced Matching**: ML-based matching algorithm
9. **Route Optimization**: Best route suggestions
10. **Multi-stop Trips**: Support for multiple pickups/dropoffs

## License

Part of the EasyMO platform. See main repository for license details.

## Support

For issues or questions, please contact the development team or open an issue in the repository.
