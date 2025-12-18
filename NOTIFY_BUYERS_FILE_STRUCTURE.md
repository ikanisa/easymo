# Notify-Buyers Edge Function - File Structure & Usage

## ✅ FILES THAT ARE USED (KEEP THESE)

### Core Files (Required)
```
notify-buyers/
├── index.ts                          ✅ MAIN ENTRY POINT
├── deno.json                         ✅ Deno configuration
├── function.json                     ✅ Function metadata
│
├── core/
│   ├── agent.ts                      ✅ Types (MarketplaceContext, BuyAndSellContext, AgentResponse)
│   │                                  ✅ getWelcomeMessage() function
│   │                                  ✅ Used by: index.ts, interactive-buttons.ts, agent-enhanced.ts
│   │
│   └── agent-enhanced.ts             ✅ MAIN AI AGENT (EnhancedMarketplaceAgent)
│                                      ✅ Used by: index.ts
│
├── utils/
│   ├── index.ts                      ✅ extractWhatsAppMessage()
│   │                                  ✅ Location parsing utilities
│   │                                  ✅ Used by: index.ts
│   │
│   └── error-handling.ts             ✅ classifyError(), serializeError()
│                                      ✅ Used by: index.ts
│
└── handlers/
    ├── interactive-buttons.ts        ✅ handleInteractiveButton()
    │                                  ✅ getProfileContext()
    │                                  ✅ Used by: index.ts, state-machine.ts
    │
    └── state-machine.ts              ✅ handleStateTransition()
                                      ✅ Used by: index.ts
```

### My Business Feature (Used for Business CRUD)
```
notify-buyers/
└── my-business/
    ├── list.ts                       ✅ listMyBusinesses()
    │                                  ✅ startCreateBusiness()
    │                                  ✅ handleBusinessSelection()
    │                                  ✅ Used by: interactive-buttons.ts, state-machine.ts
    │
    ├── create.ts                     ✅ handleCreateBusinessName()
    │                                  ✅ Used by: interactive-buttons.ts, state-machine.ts
    │
    ├── update.ts                     ✅ startEditBusiness()
    │                                  ✅ promptEditField()
    │                                  ✅ handleUpdateBusinessField()
    │                                  ✅ Used by: interactive-buttons.ts, state-machine.ts
    │
    ├── delete.ts                     ✅ confirmDeleteBusiness()
    │                                  ✅ handleDeleteBusiness()
    │                                  ✅ Used by: interactive-buttons.ts
    │
    ├── search.ts                     ✅ handleBusinessNameSearch()
    │                                  ✅ handleBusinessClaim()
    │                                  ✅ Used by: state-machine.ts
    │
    └── add_manual.ts                 ✅ startManualBusinessAdd()
    │                                  ✅ handleManualBusinessStep()
    │                                  ✅ handleLocationShared()
    │                                  ✅ Used by: state-machine.ts
    │
    └── index.ts                      ❓ Check if used (exports from other files)
```

## ❌ FILES THAT ARE NOT USED (CAN BE DELETED)

### Test Files (Not needed in production)
```
notify-buyers/
└── __tests__/
    ├── agent.test.ts                 ❌ Test file
    ├── media.test.ts                 ❌ Test file
    └── vendor_inquiry.test.ts        ❌ Test file
```

### Unused Core Files
```
notify-buyers/
└── core/
    └── agent.test.ts                 ❌ Test file
```

### Unused Handlers
```
notify-buyers/
└── handlers/
    ├── interactive-buttons.test.ts   ❌ Test file
    └── vendor-response-handler.ts    ❌ NOT IMPORTED ANYWHERE
                                      ❌ Uses VendorOutreachService (also unused)
```

### Unused Services
```
notify-buyers/
└── services/
    ├── vendor-outreach.ts            ❌ NOT IMPORTED (only by vendor-response-handler.ts)
    │                                  ❌ Replaced by: _shared/broadcast/vendor-outreach.ts
    │
    └── user-memory.ts                ❌ NOT IMPORTED ANYWHERE
                                      ❌ Replaced by: _shared/context/user-context.ts
```

### Unused Flows
```
notify-buyers/
└── flows/
    └── proactive-outreach-workflow.ts ❌ NOT IMPORTED ANYWHERE
                                       ❌ Uses unused services
```

### Unused Database Layer
```
notify-buyers/
└── db/
    └── index.ts                      ❌ NOT IMPORTED ANYWHERE
                                      ❌ Database operations moved to shared modules
```

### Unused Media Handler
```
notify-buyers/
└── media.ts                          ❌ NOT IMPORTED ANYWHERE
                                      ❌ Media handling not currently used
```

### Unused Welcome Handler
```
notify-buyers/
└── show_ai_welcome.ts                ❌ NOT IMPORTED ANYWHERE
                                      ❌ Welcome handled by core/agent.ts
```

## 📊 Summary

### Files to KEEP (15 files):
1. ✅ `index.ts` - Main entry point
2. ✅ `deno.json` - Configuration
3. ✅ `function.json` - Function metadata
4. ✅ `core/agent.ts` - Types and welcome message
5. ✅ `core/agent-enhanced.ts` - Main AI agent
6. ✅ `utils/index.ts` - Message extraction utilities
7. ✅ `utils/error-handling.ts` - Error handling
8. ✅ `handlers/interactive-buttons.ts` - Button handling
9. ✅ `handlers/state-machine.ts` - State transitions
10. ✅ `my-business/list.ts` - Business listing
11. ✅ `my-business/create.ts` - Business creation
12. ✅ `my-business/update.ts` - Business updates
13. ✅ `my-business/delete.ts` - Business deletion
14. ✅ `my-business/search.ts` - Business search
15. ✅ `my-business/add_manual.ts` - Manual business addition
16. ❓ `my-business/index.ts` - Check if used (exports)

### Files to DELETE (10+ files):
1. ❌ `__tests__/agent.test.ts` - Test file
2. ❌ `__tests__/media.test.ts` - Test file
3. ❌ `__tests__/vendor_inquiry.test.ts` - Test file
4. ❌ `core/agent.test.ts` - Test file
5. ❌ `handlers/interactive-buttons.test.ts` - Test file
6. ❌ `handlers/vendor-response-handler.ts` - Not imported
7. ❌ `services/vendor-outreach.ts` - Replaced by shared module
8. ❌ `services/user-memory.ts` - Replaced by shared module
9. ❌ `flows/proactive-outreach-workflow.ts` - Not imported
10. ❌ `db/index.ts` - Not imported
11. ❌ `media.ts` - Not imported
12. ❌ `show_ai_welcome.ts` - Not imported

## 🔍 Import Dependency Tree

```
index.ts
├── core/agent.ts (types, getWelcomeMessage)
├── core/agent-enhanced.ts (EnhancedMarketplaceAgent)
├── utils/index.ts (extractWhatsAppMessage)
├── utils/error-handling.ts (classifyError, serializeError)
├── handlers/interactive-buttons.ts
│   ├── core/agent.ts (getWelcomeMessage, getGreetingMessage)
│   └── my-business/*.ts (all files)
└── handlers/state-machine.ts
    ├── handlers/interactive-buttons.ts (ProfileContext type)
    └── my-business/*.ts (all files)
```

## ✅ Final Structure (After Cleanup)

```
notify-buyers/
├── index.ts                          ✅
├── deno.json                         ✅
├── function.json                     ✅
│
├── core/
│   ├── agent.ts                      ✅
│   └── agent-enhanced.ts             ✅
│
├── utils/
│   ├── index.ts                      ✅
│   └── error-handling.ts             ✅
│
├── handlers/
│   ├── interactive-buttons.ts        ✅
│   └── state-machine.ts              ✅
│
└── my-business/
    ├── list.ts                       ✅
    ├── create.ts                     ✅
    ├── update.ts                     ✅
    ├── delete.ts                     ✅
    ├── search.ts                     ✅
    ├── add_manual.ts                 ✅
    └── index.ts                      ❓ (check if used)
```

**Total Files to Keep**: ~15-16 files
**Total Files to Delete**: ~12 files

---

**Status**: Ready for cleanup
**Last Updated**: 2025-12-18

