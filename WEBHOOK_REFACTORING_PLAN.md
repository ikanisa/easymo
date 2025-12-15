# Webhook Refactoring Plan

**Date**: 2025-01-15  
**Scope**: All 5 webhooks (core, mobility, buy-sell, insurance, profile)  
**Goal**: Improve code organization, reduce complexity, extract handlers

---

## Current State Analysis

| Webhook | Lines | Status | Priority |
|---------|-------|--------|----------|
| `wa-webhook-core` | 337 | ✅ Good structure | Low |
| `wa-webhook-insurance` | 192 | ✅ Simple, clean | Low |
| `wa-webhook-buy-sell` | 610 | ✅ Good handlers | Medium |
| `wa-webhook-mobility` | 809 | ⚠️ Large index.ts | Medium |
| `wa-webhook-profile` | 1194 | 🔴 **TOO LARGE** | **HIGH** |

---

## Refactoring Strategy

### 1. wa-webhook-profile (PRIORITY: HIGH)

**Current Issues**:
- 1194 lines in single index.ts file
- Multiple responsibilities mixed together
- Hard to maintain and test

**Refactoring Plan**:
1. Extract handler functions to `handlers/` directory:
   - `handlers/language.ts` - Language preference handling
   - `handlers/locations.ts` - Location management (already exists, expand)
   - `handlers/menu.ts` - Menu handling (already exists, expand)
   - `handlers/wallet.ts` - Wallet operations (already exists, expand)
   - `handlers/edit.ts` - Profile editing (already exists, expand)
   - `handlers/help.ts` - Help and support

2. Extract utility functions:
   - `utils/error-handling.ts` - Error formatting and sanitization
   - `utils/coordinates.ts` - Coordinate parsing and validation
   - `utils/response.ts` - Response builders (already exists)

3. Extract middleware:
   - `middleware/cache.ts` - Response caching logic
   - `middleware/circuit-breaker.ts` - Circuit breaker setup

**Target**: Reduce index.ts to ~300-400 lines

---

### 2. wa-webhook-mobility (PRIORITY: MEDIUM)

**Current Issues**:
- 809 lines in index.ts
- Some handlers already extracted but main file still large

**Refactoring Plan**:
1. Extract remaining handlers:
   - `handlers/menu.ts` - Main menu handling
   - `handlers/interactive.ts` - Interactive button handling

2. Extract utilities:
   - `utils/error-formatting.ts` - Error formatting (already exists as function)

**Target**: Reduce index.ts to ~400-500 lines

---

### 3. wa-webhook-buy-sell (PRIORITY: MEDIUM)

**Current Issues**:
- 610 lines in index.ts
- Good handler structure but main file could be cleaner

**Refactoring Plan**:
1. Extract interactive button handlers to `handlers/interactive-buttons.ts` (already exists, expand)
2. Extract state handlers to `handlers/state-machine.ts` (already exists, expand)
3. Clean up main index.ts to focus on routing

**Target**: Reduce index.ts to ~300-400 lines

---

### 4. wa-webhook-core (PRIORITY: LOW)

**Current Issues**:
- 337 lines - acceptable size
- Some handlers already extracted

**Refactoring Plan**:
1. Extract phone number extraction to `utils/payload.ts`
2. Minor cleanup of routing logic

**Target**: Keep under 400 lines, improve readability

---

### 5. wa-webhook-insurance (PRIORITY: LOW)

**Current Issues**:
- 192 lines - good size
- Has console.warn that needs fixing

**Refactoring Plan**:
1. Fix console.warn → logStructuredEvent
2. Extract contact fetching to `handlers/contacts.ts`
3. Extract message building to `utils/messages.ts`

**Target**: Keep under 200 lines, improve structure

---

## Execution Order

1. ✅ **wa-webhook-insurance** - Quick win (fix console.warn, extract handlers)
2. ✅ **wa-webhook-profile** - High priority (major refactoring)
3. ✅ **wa-webhook-mobility** - Medium priority
4. ✅ **wa-webhook-buy-sell** - Medium priority
5. ✅ **wa-webhook-core** - Low priority (minor cleanup)

---

## Refactoring Principles

1. **Single Responsibility**: Each handler should do one thing
2. **Extract, Don't Duplicate**: Move code to handlers, don't copy
3. **Maintain Tests**: Ensure existing tests still pass
4. **Preserve Functionality**: No breaking changes
5. **Improve Readability**: Clear function names, good organization

---

## Success Metrics

- ✅ All webhooks under 500 lines in index.ts
- ✅ All handlers properly extracted
- ✅ No console.log statements (use structured logging)
- ✅ All tests passing
- ✅ No functionality changes

