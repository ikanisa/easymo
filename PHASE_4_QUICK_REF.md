# Phase 4: Quick Reference

## ✅ What's Complete (65%)

### Shared Modules (100%)
- ✅ Config: env, constants (3 files)
- ✅ Types: context, messages, responses (4 files)
- ✅ State: machine, store (3 files)
- ✅ I18n: translator, locales (5 files)
- ✅ Messaging: builder, components, client (4 files)

### Services Refactored (100%)
- ✅ wa-webhook-core: 450 → 325 LOC (28%)
- ✅ wa-webhook-mobility: 612 → 488 LOC (20%)
- ✅ wa-webhook-profile: 1142 → 537 LOC (53%)
- ✅ wa-webhook-insurance: 398 → 374 LOC (6%)

**Total: 878 lines eliminated (34% reduction)**

---

## 📁 File Structure

```
supabase/functions/
├── _shared/                          # Shared infrastructure
│   ├── config/
│   │   ├── env.ts                    # Environment config
│   │   ├── constants.ts              # App constants
│   │   └── index.ts
│   ├── types/
│   │   ├── context.ts                # Context types
│   │   ├── messages.ts               # Message types
│   │   ├── responses.ts              # Response types
│   │   └── index.ts
│   ├── state/
│   │   ├── state-machine.ts          # Typed state machine
│   │   ├── store.ts                  # State store
│   │   └── index.ts
│   ├── i18n/
│   │   ├── translator.ts             # Translation function
│   │   ├── locales/
│   │   │   ├── en.ts
│   │   │   ├── fr.ts
│   │   │   ├── rw.ts
│   │   │   └── sw.ts
│   │   └── index.ts
│   └── messaging/
│       ├── builder.ts                # Message builder
│       ├── components/index.ts       # UI components
│       ├── client.ts                 # WA client
│       └── index.ts
│
├── wa-webhook-core/
│   ├── index-refactored.ts          # ✅ 325 LOC
│   └── router/
│       ├── index.ts
│       ├── keyword-router.ts
│       ├── state-router.ts
│       └── forwarder.ts
│
├── wa-webhook-mobility/
│   ├── index-refactored.ts          # ✅ 488 LOC
│   └── handlers/
│       ├── nearby.ts
│       ├── schedule.ts
│       ├── trip_lifecycle.ts
│       └── ...
│
├── wa-webhook-profile/
│   ├── index-refactored.ts          # ✅ 537 LOC
│   └── handlers/
│       ├── profile/
│       ├── wallet/
│       └── business/
│
└── wa-webhook-insurance/
    ├── index-refactored.ts          # ✅ 374 LOC
    └── insurance/
        ├── index.ts
        ├── ins_handler.ts
        └── claims.ts
```

---

## 🎯 Usage Examples

### Import Shared Modules
```typescript
// Config
import { getEnv, SERVICES, WA_IDS, STATE_KEYS } from "../_shared/config/index.ts";

// Types
import type { RouterContext, WebhookPayload } from "../_shared/types/index.ts";

// State
import { ensureProfile, getState } from "../_shared/state/index.ts";

// Messaging
import { sendList, mobilityMenuList } from "../_shared/messaging/index.ts";

// Security
import { createSecurityMiddleware } from "../_shared/security/middleware.ts";

// Observability
import { logStructuredEvent } from "../_shared/observability.ts";
```

### Standard Service Structure
```typescript
// 1. Initialization
const SERVICE_NAME = SERVICES.XXX;
const security = createSecurityMiddleware(SERVICE_NAME);
const errorHandler = createErrorHandler(SERVICE_NAME);

// 2. Request Handler
serve(async (req) => {
  // Health check
  // Webhook verification
  // Security check
  // Parse & route
});

// 3. Routing
async function routeMessage(ctx, message, state) {
  if (interactive) return handleInteractiveMessage(...);
  if (location) return handleLocationMessage(...);
  if (media) return handleMediaMessage(...);
  if (text) return handleTextMessage(...);
}
```

---

## 🔄 Next: Testing & Docs (16 hours)

### Testing (9 hours)
- Unit tests (3 hrs)
- Integration tests (3 hrs)
- E2E tests (3 hrs)

### Documentation (7 hours)
- Migration guide (2 hrs)
- Architecture docs (3 hrs)
- Team training (2 hrs)

---

## 📊 Progress

- Files: 34/52 (65%)
- Services: 4/4 (100%)
- Time: 12/28 hours
- Next: Testing

**Last Updated**: 2025-12-02 23:25:00
