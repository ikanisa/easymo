# @easymo/flags

Feature flags for the EasyMO platform.

## Overview

Feature flags allow enabling/disabling features at runtime. All new features MUST be gated behind feature flags that default to OFF in production.

## Usage

```typescript
import { isFeatureEnabled, FEATURE_FLAGS, requireFeature } from '@easymo/flags';

// Check if a feature is enabled
if (isFeatureEnabled(FEATURE_FLAGS.VENDOR_PORTAL)) {
  // Vendor portal feature code
}

// Require a feature (throws if not enabled)
requireFeature(FEATURE_FLAGS.MOMO_TERMINAL_ADMIN, 'MoMo Terminal admin is not available');
```

## Configuration

Feature flags are controlled via environment variables:

```bash
# Enable a feature
FEATURE_VENDOR_PORTAL=true

# Disable a feature (default)
FEATURE_MARKETPLACE=false
```

## Available Flags

| Flag | Description | Default |
|------|-------------|---------|
| `vendor_portal` | SACCO/MFI vendor portal | `false` |
| `sacco_reconciliation` | SACCO reconciliation features | `false` |
| `ikimina_management` | Ikimina (savings groups) management | `false` |
| `momo_terminal_admin` | MoMo Terminal admin panel | `false` |
| `momo_terminal_sms_webhook` | MoMo Terminal SMS webhook | `false` |
| `momo_terminal_nfc` | MoMo Terminal NFC features | `false` |
| `ai_agents_admin` | AI Agents administration | `true` |
| `whatsapp_admin` | WhatsApp administration | `true` |
| `marketplace` | Marketplace features | `false` |
| `voice_calls` | Voice call features | `false` |
| `video_calls` | Video call features | `false` |
| `real_estate_pwa` | Real estate PWA | `false` |

## Ground Rules

Per `docs/GROUND_RULES.md`:
- All new features MUST be gated behind feature flags
- Feature flags MUST default to OFF in production
- Test both enabled and disabled states

## Merger Note

This package structure follows the Ibimina repository pattern.
Additional flags will be added during the merger.
