# wa-webhook-mobility

**Purpose**: Handle all WhatsApp interactions for Mobility services\
**Extracted from**: wa-webhook (Phase 3 - Week 3)\
**Size**: ~3,000 LOC\
**Status**: 🚧 Under Development

## ⛔ PROHIBITED (GUARDRAILS)

**The following modules are STRICTLY PROHIBITED in this function. DO NOT
implement:**

| ❌ NEVER ADD               | Reason                                     |
| -------------------------- | ------------------------------------------ |
| Payment processing         | System does not support payments           |
| Trip lifecycle management  | Users handle trips directly via WhatsApp   |
| Trip tracking              | No real-time tracking or status updates    |
| Trip notifications         | Users communicate directly via WhatsApp    |
| Driver response handlers   | Users interact off-system after matching   |
| Fare calculation (fare.ts) | Pricing is handled externally              |
| Driver verification/OCR    | Moved to separate verification service     |
| AI agents integration      | Use dedicated AI functions instead         |
| Insurance verification     | Not required for basic driver registration |

**Why?** This function handles **only**:

- Trip scheduling (future trips)
- Nearby driver/passenger search (creates trip intents)
- Database of scheduled trips and trip intents

**After users get nearby drivers/passengers list, they chat on WhatsApp
directly. The system is "off" from there - users interact between themselves off
the system.**

## Features

- 🚗 Simple ride matching: Users choose "ride" from home menu, share location, get list of nearby drivers/passengers
- 📍 Location-based matching: System finds top 10 opposite role users based on location
- 👤 Role selection: First-time users select driver or passenger role (stored in profile)

**Note**: The system is simplified - no scheduling, no nearby driver/passenger specific flows, no vehicle management. Users share location and get a list of matches. They communicate directly via WhatsApp after matching.

## Files

- `index.ts` - Main handler with simplified flow
- `handlers/index.ts` - Handler registry (legacy, not actively used)
- `router/button-handlers.ts` - Button handler mappings (documentation)

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
- [x] Remove payment processing
- [x] Remove trip management
- [ ] Add comprehensive tests
- [ ] Deploy to staging
