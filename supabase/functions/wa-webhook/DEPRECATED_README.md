# ⚠️ DEPRECATED - DO NOT USE

This function has been **deprecated** and replaced by the microservice architecture.

## New Architecture

```
WhatsApp → wa-webhook-core (router) → domain microservices
                                      ├─ wa-webhook-ai-agents
                                      ├─ wa-webhook-mobility
                                      ├─ wa-webhook-wallet
                                      ├─ wa-webhook-jobs
                                      ├─ wa-webhook-property
                                      ├─ wa-webhook-insurance
                                      └─ wa-webhook-marketplace
```

## Migration Information

- **Deprecated Date:** 2025-11-24
- **Replacement:** wa-webhook-core
- **Webhook URL:** `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core`

## Why Deprecated?

1. **Monolithic architecture** - Hard to scale and maintain
2. **500 errors** - Duplicate key issues in chat_state
3. **Poor separation of concerns** - All domains in one function
4. **Difficult debugging** - Hard to isolate issues

## What Replaced It?

**wa-webhook-core:** Central router that forwards messages to domain-specific microservices

**Microservices:**
- `wa-webhook-ai-agents` - AI agent orchestration
- `wa-webhook-mobility` - Rides, drivers, scheduling
- `wa-webhook-wallet` - Tokens, transfers, rewards
- `wa-webhook-jobs` - Job listings, applications
- `wa-webhook-property` - Property rentals
- `wa-webhook-insurance` - Motor insurance, claims
- `wa-webhook-marketplace` - Buy & sell

## This Directory Contains

- **Reference code** - For historical purposes
- **Shared library** - Being migrated to `_shared/wa-webhook-shared/`
- **Documentation** - Implementation guides and examples

## DO NOT

- ❌ Deploy this function
- ❌ Update WhatsApp webhook URL to this function
- ❌ Add new features here
- ❌ Fix bugs here (fix in microservices instead)

## DO

- ✅ Use wa-webhook-core for new deployments
- ✅ Migrate remaining code to `_shared/wa-webhook-shared/`
- ✅ Reference this code for understanding legacy behavior
- ✅ Update microservices for new features

## Questions?

See the migration guide: `/Users/jeanbosco/.gemini/antigravity/brain/3e8198fe-fffd-4e38-9e78-6a42a3abd7a7/wa_webhook_migration_plan.md`
