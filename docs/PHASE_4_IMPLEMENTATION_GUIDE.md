# Phase 4: Code Refactoring & Modularization - Implementation Guide

## 🎯 Overview

Phase 4 is a comprehensive refactoring to split large handler files into focused modules, extract shared utilities, and standardize code structure across all microservices.

**Estimated Duration**: 28 hours (5-6 days)  
**Priority**: 🟡 High  
**Status**: 🟡 In Progress (Foundation Complete)

## ✅ Completed (3 hours)

### 1. Config Module (`_shared/config/`)
- ✅ **env.ts** - Environment variable management with validation
  - Singleton EnvLoader class
  - Fallback support for multiple env var names
  - Type-safe configuration
  - Production security warnings
  
- ✅ **constants.ts** - Application constants
  - Service names (CORE, PROFILE, MOBILITY, INSURANCE)
  - WhatsApp interactive IDs (70+ constants)
  - State keys (30+ states)
  - Vehicle types, trip statuses, claim types
  - Limits & thresholds
  - Timeouts
  - Regex patterns
  
- ✅ **index.ts** - Module exports

### 2. Types Module (`_shared/types/`)
- ✅ **context.ts** - Context and handler types
  - BaseContext, RouterContext, HandlerContext
  - UserState, StateUpdate
  - Handler, HandlerResult, Middleware
  - UserProfile, Location types

## 🔄 Remaining Work (25 hours)

### Priority 1: Complete Types Module (30 min)

```typescript
// _shared/types/messages.ts
- WhatsApp message types (Text, Interactive, Location, Image, Document)
- Webhook payload structures
- Outgoing message types (Button, List, Template)

// _shared/types/responses.ts
- API response types (Success, Error)
- Health check responses
- Operation results (Transfer, Trip, Claim)

// _shared/types/index.ts
- Export all type modules
```

### Priority 2: State Management Module (2 hours)

```typescript
// _shared/state/state-machine.ts
- StateMachine class with transition validation
- STATE_TRANSITIONS map (defines valid state flows)
- Transition logging and validation

// _shared/state/store.ts
- getState, setState, clearState functions
- ensureProfile helper
- Database operations with error handling

// _shared/state/index.ts
- Export state management utilities
```

### Priority 3: Messaging Module (5 hours)

```typescript
// _shared/messaging/builder.ts
- TextMessageBuilder (fluent API)
- ButtonMessageBuilder
- ListMessageBuilder

// _shared/messaging/components/index.ts
- Reusable UI components:
  - Success/error/warning messages
  - Confirmation dialogs
  - Home menu, mobility menu, insurance menu
  - Vehicle selection, location prompts
  - Trip status messages

// _shared/messaging/client.ts
- WhatsAppClient class
- API methods: sendText, sendButtons, sendList, sendLocation
- Media download helpers
- Context-aware convenience functions

// _shared/messaging/index.ts
- Export all messaging utilities
```

### Priority 4: I18n Module (2 hours)

```typescript
// _shared/i18n/translator.ts
- Translation function with fallback
- Pluralization support
- Parameter interpolation

// _shared/i18n/locales/en.ts, fr.ts, rw.ts
- Translation dictionaries
- Common phrases, menu labels, error messages

// _shared/i18n/index.ts
- Export translator and locales
```

### Priority 5: Refactor wa-webhook-core (4 hours)

**Current**: Monolithic 800+ line index.ts  
**Target**: Modular < 200 line entry point

```
wa-webhook-core/
├── index.ts (< 200 LOC) - Entry point
├── router/
│   ├── index.ts - Main routing logic
│   ├── keyword-router.ts - Text keyword matching
│   ├── state-router.ts - State-based routing
│   └── forwarder.ts - Service forwarding
├── handlers/
│   ├── home.ts - Home menu handler
│   ├── health.ts - Health check
│   └── webhook.ts - Webhook verification
└── __tests__/
```

### Priority 6: Refactor wa-webhook-profile (3 hours)

```
wa-webhook-profile/
├── index.ts (< 200 LOC)
├── handlers/
│   ├── profile/
│   │   ├── view.ts
│   │   ├── edit.ts
│   │   └── settings.ts
│   ├── wallet/
│   │   ├── balance.ts
│   │   ├── transfer.ts
│   │   ├── history.ts
│   │   └── deposit.ts
│   └── business/
│       ├── create.ts
│       ├── edit.ts
│       └── vehicles.ts
└── __tests__/
```

### Priority 7: Refactor wa-webhook-mobility (4 hours)

**Critical**: Split 1200+ line nearby.ts

```
wa-webhook-mobility/
├── index.ts (< 200 LOC)
├── handlers/
│   ├── nearby/
│   │   ├── drivers.ts
│   │   ├── passengers.ts
│   │   ├── vehicle-select.ts
│   │   └── location.ts
│   ├── schedule/
│   │   ├── booking.ts
│   │   ├── management.ts
│   │   └── recurring.ts
│   ├── trip/
│   │   ├── lifecycle.ts
│   │   ├── tracking.ts
│   │   ├── payment.ts
│   │   └── rating.ts
│   └── driver/
│       ├── online.ts
│       ├── verification.ts
│       └── insurance.ts
├── services/
│   ├── matching.ts
│   ├── fare-calculator.ts
│   └── notifications.ts
└── __tests__/
```

### Priority 8: Refactor wa-webhook-insurance (3 hours)

```
wa-webhook-insurance/
├── index.ts (< 200 LOC)
├── handlers/
│   ├── documents/
│   │   ├── upload.ts
│   │   ├── ocr.ts
│   │   └── verification.ts
│   ├── claims/
│   │   ├── submit.ts
│   │   ├── status.ts
│   │   └── documents.ts
│   └── support/
│       └── help.ts
├── services/
│   ├── ocr-processor.ts
│   ├── lead-manager.ts
│   └── admin-notifier.ts
└── __tests__/
```

### Priority 9: Testing & Documentation (3 hours)

- Update tests for new module structure
- Add integration tests for routing
- Document migration guide
- Update README files

## 📋 Implementation Checklist

### Shared Modules
- [x] Config: env.ts
- [x] Config: constants.ts
- [x] Config: index.ts
- [x] Types: context.ts
- [ ] Types: messages.ts
- [ ] Types: responses.ts
- [ ] Types: index.ts
- [ ] State: state-machine.ts
- [ ] State: store.ts
- [ ] State: index.ts
- [ ] Messaging: builder.ts
- [ ] Messaging: components/index.ts
- [ ] Messaging: client.ts
- [ ] Messaging: index.ts
- [ ] I18n: translator.ts
- [ ] I18n: locales (en, fr, rw)
- [ ] I18n: index.ts

### Service Refactoring
- [ ] wa-webhook-core entry point
- [ ] wa-webhook-core router modules
- [ ] wa-webhook-profile handlers
- [ ] wa-webhook-mobility handlers
- [ ] wa-webhook-mobility nearby split
- [ ] wa-webhook-insurance handlers

### Testing
- [ ] Unit tests updated
- [ ] Integration tests added
- [ ] TypeScript compilation
- [ ] Health checks validated

## 🚀 Quick Start Commands

```bash
# Verify current structure
cd /Users/jeanbosco/workspace/easymo
ls -la supabase/functions/_shared/config/
ls -la supabase/functions/_shared/types/

# View created modules
cat supabase/functions/_shared/config/env.ts
cat supabase/functions/_shared/config/constants.ts
cat supabase/functions/_shared/types/context.ts

# Next: Continue with types/messages.ts
# See detailed code in original Phase 4 spec
```

## 🎯 Success Criteria

| Metric | Target | Current |
|--------|--------|---------|
| Index.ts file size | < 200 LOC each | 🔄 |
| Shared module coverage | 100% services | 30% |
| Type safety | 0 TypeScript errors | ✅ |
| Code duplication | 90%+ reduction | 🔄 |
| Handler file size | < 300 LOC each | 🔄 |
| Tests passing | 100% | 🔄 |

## ⚠️ Important Notes

1. **Incremental Approach**: Implement one module at a time
2. **Test After Each Module**: Don't break existing functionality
3. **Commit Frequently**: Small, focused commits
4. **Backward Compatibility**: Maintain existing APIs during transition
5. **Team Coordination**: Communicate changes to all developers

## 📚 References

- Original Phase 4 Spec: See user prompt
- Ground Rules: `/docs/GROUND_RULES.md`
- Architecture: `/docs/ARCHITECTURE.md`
- Current Services: `/supabase/functions/wa-webhook-*/`

## 🤝 Next Steps

1. **Review completed modules** - Validate config and types
2. **Choose next priority** - Recommend: Complete types module
3. **Implement incrementally** - One file at a time
4. **Test thoroughly** - After each addition
5. **Document as you go** - Update this guide

## 📞 Support

For questions or issues during Phase 4 implementation:
- Reference this guide
- Check existing `_shared/` modules for patterns
- Follow TypeScript conventions in codebase
- Maintain observability (logging, metrics)

---

**Status**: Foundation complete (config + context types)  
**Next**: Complete types module (messages.ts, responses.ts)  
**Last Updated**: 2025-12-02
