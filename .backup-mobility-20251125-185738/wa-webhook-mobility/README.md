# wa-webhook-mobility

**Purpose**: Handle all WhatsApp interactions for Mobility services  
**Extracted from**: wa-webhook (Phase 3 - Week 3)  
**Size**: ~3,165 LOC  
**Status**: 🚧 Under Development  

## Features

- 🚗 Trip scheduling & booking
- 📍 Nearby driver search
- 💰 Agent quotes
- 🚙 Driver onboarding
- 🔔 Ride subscriptions
- 🚘 Vehicle plate verification

## Files

- `schedule.ts` (1,298 LOC) - Trip scheduling ⚠️ NEEDS REFACTORING
- `nearby.ts` (736 LOC) - Nearby driver search
- `agent_quotes.ts` - Price quotes
- `subscription.ts` - Ride subscriptions
- `vehicle_plate.ts` - Plate verification
- `driver_onboarding.ts` - Driver registration

## Development

```bash
cd supabase/functions/wa-webhook-mobility
deno check index.ts
deno test --allow-all
./deploy.sh
```

## Endpoints

- `GET /health` - Health check
- `POST /` - WhatsApp webhook

## Next Steps

- [ ] Refactor schedule.ts into 3 files
- [ ] Update imports to use shared packages
- [ ] Add comprehensive tests
- [ ] Deploy to staging
