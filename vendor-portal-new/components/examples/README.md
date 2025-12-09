# Plugin Integration Examples

This directory contains example components demonstrating how to use the enhanced
Capacitor plugins in your Next.js application.

## Available Examples

### NotificationExample

Demonstrates the `EnhancedNotifications` plugin:

- Request notification permissions (Android 13+)
- Show notifications with custom channels
- Add action buttons to notifications
- Notification grouping
- Cancel individual or all notifications

**Usage**:

```tsx
import { NotificationExample } from "@/components/examples";

export default function DemoPage() {
  return <NotificationExample />;
}
```

### NetworkMonitorExample

Demonstrates the `NetworkMonitor` plugin:

- Display current network status
- Monitor network changes in real-time
- Show connection quality metrics (bandwidth)
- Detect metered connections
- View status history

**Usage**:

```tsx
import { NetworkMonitorExample } from "@/components/examples";

export default function DemoPage() {
  return <NetworkMonitorExample />;
}
```

## Integration in Your App

### 1. Basic Integration

```tsx
// In any client component
"use client";

import { useEffect, useState } from "react";
import EnhancedNotifications from "@/lib/plugins/enhanced-notifications";

export function MyComponent() {
  useEffect(() => {
    // Check permissions on mount
    EnhancedNotifications.checkPermissions().then(({ granted }) => {
      if (!granted) {
        // Request permissions
        EnhancedNotifications.requestPermissions();
      }
    });
  }, []);

  const handleNotification = async () => {
    await EnhancedNotifications.showNotification({
      title: "Hello",
      body: "This is a test notification",
      channelId: "default",
    });
  };

  return <button onClick={handleNotification}>Show Notification</button>;
}
```

### 2. Network-Aware Data Fetching

```tsx
"use client";

import { useEffect, useState } from "react";
import NetworkMonitor from "@/lib/plugins/network-monitor";

export function DataFetcher() {
  const [isOnline, setIsOnline] = useState(true);
  const [isMetered, setIsMetered] = useState(false);

  useEffect(() => {
    // Start monitoring
    NetworkMonitor.startMonitoring();

    // Listen for changes
    NetworkMonitor.addListener("networkStatusChange", (status) => {
      setIsOnline(status.connected);
      setIsMetered(status.isMetered ?? false);

      if (!status.connected) {
        // Show offline banner
        showOfflineMessage();
      } else if (status.isMetered) {
        // Reduce data usage
        enableDataSaver();
      }
    });

    return () => {
      NetworkMonitor.stopMonitoring();
    };
  }, []);

  return (
    <div>
      {!isOnline && <div className="offline-banner">You are offline</div>}
      {isMetered && <div className="metered-banner">Limited data mode</div>}
    </div>
  );
}
```

### 3. Transaction Notifications

```tsx
// In your transaction processing logic
import EnhancedNotifications from "@/lib/plugins/enhanced-notifications";

async function processTransaction(transaction: Transaction) {
  try {
    const result = await submitTransaction(transaction);

    // Show success notification
    await EnhancedNotifications.showNotification({
      title: "Transaction Complete",
      body: `Successfully processed ${transaction.amount} RWF`,
      channelId: "transactions",
      groupKey: "transactions",
      actions: [
        { id: "view", title: "View Receipt" },
        { id: "share", title: "Share" },
      ],
      data: JSON.stringify({ transactionId: result.id }),
    });
  } catch (error) {
    // Show error notification
    await EnhancedNotifications.showNotification({
      title: "Transaction Failed",
      body: error.message,
      channelId: "alerts",
      priority: 1, // High priority
    });
  }
}
```

## Testing on Device

1. **Build and sync**:

```bash
cd apps/admin
pnpm run build
npx cap sync android
```

2. **Open in Android Studio**:

```bash
npx cap open android
```

3. **Run on device** and navigate to your demo page

4. **Test permissions**: On Android 13+, you'll see permission request dialogs

5. **Test notifications**: Try different channels, priorities, and action
   buttons

6. **Test network monitoring**: Toggle WiFi/mobile data to see real-time updates

## Tips

- **Permissions**: Always check permissions before showing notifications
- **Error Handling**: Wrap plugin calls in try-catch blocks
- **Type Safety**: Use the provided TypeScript interfaces
- **Platform Detection**: Use `Capacitor.getPlatform()` to conditionally use
  plugins
- **Web Fallbacks**: Plugins throw errors on web - implement fallbacks if needed

## See Also

- [Plugin Development Guide](../../../docs/android/CAPACITOR_PLUGIN_GUIDE.md)
- [Performance Optimization](../../../docs/android/PERFORMANCE_OPTIMIZATION.md)
- [Quick Start Guide](../../../docs/android/QUICKSTART.md)
