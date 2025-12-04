# PWA Push Notifications Setup Guide

## Overview
This guide explains how to set up Web Push Notifications for the easyMO Client PWA and Admin Panel.

## Prerequisites
- VAPID keys for Web Push
- Service Worker configured
- HTTPS enabled (required for push notifications)

## 1. Generate VAPID Keys

```bash
# Install web-push CLI
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys

# Output:
# Public Key: BEl62iUYgUivxIkv69yViEuiBIa-Ib-5MuYy...
# Private Key: bdSiGcHIxSk-5yHfnvKF7JSSqmotA6M4...
```

## 2. Configure Environment Variables

Add to Supabase Edge Functions:

```bash
VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY
VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY
VAPID_SUBJECT=mailto:admin@easymo.rw
```

## 3. Update PWA Service Worker

### File: `client-pwa/public/sw.js`

```javascript
// Listen for push events
self.addEventListener('push', function(event) {
  const data = event.data.json();
  
  const options = {
    body: data.message,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.deep_link || '/',
      notification_id: data.id
    },
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

## 4. Request Permission in PWA

### File: `client-pwa/src/utils/notifications.ts`

```typescript
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export async function subscribeToPushNotifications(
  userId: string
): Promise<PushSubscription | null> {
  try {
    const permission = await requestNotificationPermission();
    if (!permission) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      )
    });

    // Save subscription to database
    await saveSubscription(userId, subscription);

    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function saveSubscription(
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      subscription: subscription.toJSON()
    })
  });

  if (!response.ok) {
    throw new Error('Failed to save subscription');
  }
}
```

## 5. Database Schema for Push Subscriptions

```sql
-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)
);

-- Add indexes
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY push_subscriptions_user_policy ON push_subscriptions
  FOR ALL
  USING (user_id = auth.uid());
```

## 6. Update tool-notify-user Function

### File: `supabase/functions/tool-notify-user/index.ts`

Replace the PWA push TODO with:

```typescript
async function sendPWAPushNotification(
  conversation: any,
  request: NotifyRequest,
  correlationId: string,
): Promise<{ success: boolean; message_id?: string }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get user's push subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", conversation.profile_id);

  if (subError || !subscriptions || subscriptions.length === 0) {
    // Fallback to database notification only
    return createDatabaseNotification(conversation, request);
  }

  const webpush = await import("npm:web-push@3.6.6");

  // Configure web-push
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
  );

  const payload = JSON.stringify({
    title: request.payload.title ||
      getDefaultTitle(request.notification_type, conversation.locale),
    message: request.payload.message ||
      getDefaultMessage(request.notification_type, conversation.locale),
    deep_link: request.payload.deep_link,
    actions: request.payload.action_buttons,
    id: crypto.randomUUID(),
  });

  // Send to all subscriptions
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );

        // Update last_used_at
        await supabase
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);

        return { success: true };
      } catch (error) {
        // Remove invalid subscriptions
        if (error.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
        throw error;
      }
    })
  );

  const successCount = results.filter((r) => r.status === "fulfilled").length;

  // Also create database notification as backup
  await createDatabaseNotification(conversation, request);

  return {
    success: successCount > 0,
    message_id: correlationId,
  };
}

async function createDatabaseNotification(
  conversation: any,
  request: NotifyRequest
): Promise<{ success: boolean; message_id?: string }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase.from("notifications").insert({
    profile_id: conversation.profile_id,
    type: request.notification_type,
    title: request.payload.title ||
      getDefaultTitle(request.notification_type, conversation.locale),
    message: request.payload.message ||
      getDefaultMessage(request.notification_type, conversation.locale),
    deep_link: request.payload.deep_link,
    read: false,
  }).select().single();

  if (error) throw error;

  return {
    success: true,
    message_id: data.id,
  };
}
```

## 7. Testing Push Notifications

### Manual Test

1. **Subscribe to notifications:**
```javascript
// In browser console on PWA
await subscribeToPushNotifications('user-id-here');
```

2. **Send test notification:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/tool-notify-user \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "CONVERSATION_ID",
    "channel": "pwa_push",
    "notification_type": "custom",
    "payload": {
      "title": "Test Notification",
      "message": "This is a test push notification",
      "deep_link": "/dashboard"
    }
  }'
```

3. **Verify:**
   - Notification appears on device
   - Click opens correct page
   - Database record created

## 8. Production Checklist

- [ ] VAPID keys generated and stored securely
- [ ] Service worker registered and active
- [ ] Permission request UI implemented
- [ ] Subscription saved to database
- [ ] Push notifications tested on:
  - [ ] Chrome (Desktop)
  - [ ] Chrome (Android)
  - [ ] Firefox (Desktop)
  - [ ] Safari (iOS 16.4+)
- [ ] Fallback to database notifications working
- [ ] Invalid subscriptions automatically removed
- [ ] Deep links working correctly

## 9. Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Desktop & Android |
| Firefox | ✅ Full | Desktop & Android |
| Safari | ⚠️ Limited | iOS 16.4+ only |
| Edge | ✅ Full | Chromium-based |
| Opera | ✅ Full | Chromium-based |

## 10. Troubleshooting

### Notifications not appearing
- Check service worker is registered: `navigator.serviceWorker.controller`
- Verify permission granted: `Notification.permission === 'granted'`
- Check browser console for errors
- Verify VAPID keys are correct

### Subscription fails
- Ensure HTTPS is enabled
- Check VAPID public key format
- Verify service worker scope

### Push not received
- Check subscription is saved in database
- Verify endpoint is valid
- Test with web-push CLI tool
- Check firewall/network restrictions

## Support

- Web Push Protocol: https://web.dev/push-notifications/
- VAPID Spec: https://datatracker.ietf.org/doc/html/rfc8292
- Browser Compatibility: https://caniuse.com/push-api
