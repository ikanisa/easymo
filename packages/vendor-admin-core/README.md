# @easymo/vendor-admin-core

Core admin logic for the SACCO/MFI vendor portal.

## Overview

This package provides the business logic layer for vendor portal administration:
- Member management
- Ikimina (savings groups) management
- Payment reconciliation
- SACCO administration utilities

## Usage

```typescript
import {
  // Members
  validateMember,
  validateCreateMember,
  isMemberManagementEnabled,
  type MemberService,
  
  // Ikimina
  validateIkimina,
  validateCreateIkimina,
  isIkiminaManagementEnabled,
  IKIMINA_TYPES,
  type IkiminaService,
  
  // Reconciliation
  validatePayment,
  isReconciliationEnabled,
  calculateMatchConfidence,
  type ReconciliationService,
  
  // Types
  formatMoney,
  type Money,
  type PaginatedResult,
} from '@easymo/vendor-admin-core';

// Validate member data
const result = validateMember(userData);
if (result.success) {
  // Use result.data
}

// Format currency
const display = formatMoney({ amount: 50000, currency: 'RWF' }); // "RWF 50,000"
```

## Feature Flags

All features are gated behind feature flags:

| Feature | Flag | Default |
|---------|------|---------|
| Member Management | `VENDOR_PORTAL` + `IKIMINA_MANAGEMENT` | `false` |
| Ikimina Management | `IKIMINA_MANAGEMENT` | `false` |
| Reconciliation | `SACCO_RECONCILIATION` | `false` |

## Dependencies

- `@easymo/sacco-core` - SACCO entity schemas
- `@easymo/supabase-schemas` - Database schemas
- `@easymo/flags` - Feature flags

## Merger Note

This package provides stub interfaces that will be fully implemented during the Ibimina merger.
The Ibimina repository contains the complete admin-core implementation with:
- Full service implementations
- Hooks for React integration
- State management utilities

See `docs/MERGER_PLAN.md` for details.
