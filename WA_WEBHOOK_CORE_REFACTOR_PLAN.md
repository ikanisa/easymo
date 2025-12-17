# wa-webhook-core Refactoring Plan

## Current Issues

1. **Router.ts is too large (652 lines)** - Needs to be split into smaller modules
2. **Complex routing logic** - Can be simplified
3. **Home menu handling** - Should be extracted to separate handler
4. **Health check logic** - Can be simplified

## Refactoring Goals

1. Split router.ts into smaller, focused modules
2. Extract home menu handler
3. Simplify routing logic
4. Improve error handling
5. Remove unused code
6. Better separation of concerns

## Proposed Structure

```
wa-webhook-core/
├── index.ts (main handler - simplified)
├── router.ts (routing logic only)
├── handlers/
│   ├── home-menu.ts (home menu display)
│   ├── intent-opt-out.ts (existing)
│   └── help-support.ts (existing)
├── utils/
│   └── payload.ts (existing)
└── telemetry.ts (existing)
```

## Implementation Steps

1. Extract home menu handler to separate file
2. Simplify router.ts routing logic
3. Clean up index.ts
4. Remove unused imports
5. Improve error messages



