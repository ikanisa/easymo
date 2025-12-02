# Mobility Service Extraction Notes

## Files Extracted

- schedule.ts (1,298 LOC) ⚠️ **TOO LARGE - NEEDS REFACTORING**
- nearby.ts (736 LOC)
- agent_quotes.ts (280 LOC)
- subscription.ts (140 LOC)
- vehicle_plate.ts (138 LOC)
- driver_onboarding.test.ts (290 LOC)
- intent_cache.ts + test (290 LOC)

Total: ~3,165 LOC

## Refactoring Needed

### schedule.ts → Split into 3 files:

1. **schedule-handler.ts** (~400 LOC)
   - Main routing logic
   - Menu display
   - User input handling

2. **schedule-booking.ts** (~500 LOC)
   - Booking flow
   - Date/time selection
   - Location input

3. **schedule-management.ts** (~400 LOC)
   - View bookings
   - Edit booking
   - Cancel booking

## Dependencies to Update

- Import from shared packages
- Update state management calls
- Update WhatsApp client calls
- Update i18n translations

## Testing Strategy

1. Unit tests for each handler
2. Integration tests for booking flow
3. Load tests (1000 req/s)
4. Chaos testing (kill database)

## Deployment Plan

1. Deploy standalone version (Week 3)
2. Test health check
3. Route 10% traffic
4. Monitor for issues
5. Gradual rollout to 100%
