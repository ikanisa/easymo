# @ibimina/admin-core

Shared business logic, hooks, services, and types for the Ibimina Staff Admin application.

This package provides platform-agnostic code that can be reused across web (Next.js), mobile (Capacitor), and desktop (Tauri) platforms.

## Structure

- **hooks/** - React hooks for authentication, data fetching, and offline sync
- **services/** - Business logic services for API calls and data management
- **types/** - TypeScript type definitions and interfaces
- **utils/** - Utility functions for validation, formatting, and constants
- **adapters/** - Platform abstraction interfaces for cross-platform compatibility

## Usage

```typescript
// Import from main entry point
import { useAuth, useStaff } from '@ibimina/admin-core';

// Import from specific modules
import { useAuth } from '@ibimina/admin-core/hooks';
import { AuthService } from '@ibimina/admin-core/services';
import { PlatformAdapter } from '@ibimina/admin-core/adapters';
```

## Platform Adapters

The adapter system allows the core logic to work across different platforms:

- **Web** - Browser APIs (localStorage, Notification API, window.print)
- **Mobile** - Capacitor plugins (Preferences, Push Notifications, Camera)
- **Desktop** - Tauri commands (Store, Notifications, System APIs)

Each platform provides its own implementation of the `PlatformAdapter` interface.
