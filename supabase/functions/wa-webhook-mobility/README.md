# wa-webhook-mobility

**Purpose**: Handle all WhatsApp interactions for Mobility services  
**Extracted from**: wa-webhook (Phase 3 - Week 3)  
**Size**: ~3,000 LOC  
**Status**: 🚧 Under Development  

## ⛔ PROHIBITED (GUARDRAILS)

**The following modules are STRICTLY PROHIBITED in this function. DO NOT implement:**

| ❌ NEVER ADD                 | Reason                                        |
| ---------------------------- | --------------------------------------------- |
| Payment processing           | Use separate payment functions                |
| Fare calculation (fare.ts)   | Pricing is handled externally                 |
| Driver verification/OCR      | Moved to separate verification service        |
| AI agents integration        | Use dedicated AI functions instead            |
| Insurance verification       | Not required for basic driver registration    |

**Why?** This function handles **mobility flow only** - trip matching, scheduling, and location sharing. 
Payment, verification, and AI belong in dedicated, specialized functions.

## Features

- 🚗 Trip scheduling & booking
- 📍 Nearby driver/passenger search
- 🔔 Ride subscriptions
- 🚘 Vehicle plate registration
- 🗓️ Schedule management

## Files

- `handlers/schedule.ts` - Trip scheduling re-exports
- `handlers/schedule/booking.ts` - Trip booking logic
- `handlers/schedule/management.ts` - Trip management
- `handlers/nearby.ts` (736 LOC) - Nearby driver/passenger search
- `handlers/go_online.ts` - Driver online status
- `handlers/vehicle_plate.ts` - Plate verification
- `handlers/driver_response.ts` - Driver actions
- `handlers/subscription.ts` - Ride subscriptions

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

## Configuration

Uses `config.ts` with proper environment variable fallbacks:
- `SUPABASE_URL` / `SERVICE_URL`
- `WA_SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `WA_PHONE_ID` / `WHATSAPP_PHONE_NUMBER_ID`
- `WA_TOKEN` / `WHATSAPP_ACCESS_TOKEN`
- `WA_APP_SECRET` / `WHATSAPP_APP_SECRET`

## Next Steps

- [ ] Refactor schedule/booking.ts into smaller files
- [x] Fix import path errors
- [x] Fix lazy loader module paths
- [x] Use config.ts supabase client
- [x] Remove prohibited modules (fare.ts, driver_verification.ts, ai-agents/)
- [ ] Add comprehensive tests
- [ ] Deploy to staging
