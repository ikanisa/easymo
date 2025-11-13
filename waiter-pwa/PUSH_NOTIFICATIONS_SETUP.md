# Push Notifications Setup Guide

## Overview
Enable real-time order updates and promotional messages via web push notifications.

---

## Prerequisites
- HTTPS enabled (required for Push API)
- Service Worker registered
- User permission granted
- VAPID keys generated

---

## 1. Generate VAPID Keys

```bash
# Install web-push CLI
npm install -g web-push

# Generate keys
web-push generate-vapid-keys

# Output:
# Public Key: BN...
# Private Key: X4...
```

Save these keys securely:
```bash
# Add to Supabase secrets
supabase secrets set VAPID_PUBLIC_KEY="BN..."
supabase secrets set VAPID_PRIVATE_KEY="X4..."
supabase secrets set VAPID_SUBJECT="mailto:admin@easymo.com"
```

---

## 2. Update Service Worker

Create `public/sw-push.js`:
```javascript
// Listen for push events
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    data: {
      url: data.url,
      orderId: data.orderId,
    },
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
```

---

## 3. Frontend Integration

### Request Permission
`lib/notifications.ts`:
```typescript
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
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
```

### Subscribe to Push
`lib/push-subscription.ts`:
```typescript
import { createClient } from '@/lib/supabase-client';

export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    // Check if service worker is registered
    const registration = await navigator.serviceWorker.ready;
    
    // Get VAPID public key from environment
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      throw new Error('VAPID public key not configured');
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Save subscription to database
    const supabase = createClient();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription: subscription.toJSON(),
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

### Unsubscribe
```typescript
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Remove from database
    const supabase = createClient();
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    return true;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}
```

---

## 4. Database Schema

Add to migration:
```sql
-- Push Subscriptions Table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);
```

---

## 5. Backend - Send Notifications

Create Edge Function `supabase/functions/send-push/index.ts`:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const vapidKeys = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!,
  subject: Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@easymo.com',
};

serve(async (req) => {
  try {
    const { userId, title, body, url, tag } = await req.json();

    // Get user's push subscriptions
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (error) throw error;

    // Send to all subscriptions
    const sendPromises = subscriptions.map(async ({ subscription }) => {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${vapidKeys.privateKey}`,
        },
        body: JSON.stringify({
          to: subscription.endpoint,
          notification: {
            title,
            body,
            icon: '/icon-192.png',
            data: { url, tag },
          },
        }),
      });

      return response.json();
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## 6. Usage Examples

### Order Status Update
```typescript
// When order status changes
await supabase.functions.invoke('send-push', {
  body: {
    userId: order.user_id,
    title: 'Order Update',
    body: `Your order #${order.id} is now ${order.status}`,
    url: `/order/${order.id}`,
    tag: `order-${order.id}`,
  },
});
```

### Reservation Reminder
```typescript
// 1 hour before reservation
await supabase.functions.invoke('send-push', {
  body: {
    userId: reservation.user_id,
    title: 'Reservation Reminder',
    body: `Your table is reserved in 1 hour at ${formatTime(reservation.time)}`,
    url: `/reservations/${reservation.id}`,
    tag: `reservation-${reservation.id}`,
  },
});
```

### Promotional Message
```typescript
await supabase.functions.invoke('send-push', {
  body: {
    userId: user.id,
    title: '🎉 Special Offer',
    body: '20% off all pizzas today only!',
    url: '/menu?category=pizza',
    tag: 'promo-pizza',
  },
});
```

---

## 7. Testing

### Local Testing
```bash
# Start dev server
npm run dev

# Open browser console
const permission = await Notification.requestPermission();
const registration = await navigator.serviceWorker.ready;

# Test notification
registration.showNotification('Test', {
  body: 'This is a test notification',
  icon: '/icon-192.png',
});
```

### Production Testing
```bash
# Deploy edge function
supabase functions deploy send-push

# Test via API
curl -X POST https://project.supabase.co/functions/v1/send-push \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "title": "Test",
    "body": "Test notification",
    "url": "/test"
  }'
```

---

## 8. Best Practices

### When to Send
✅ **DO send:**
- Order status updates
- Reservation confirmations
- Payment confirmations
- Important account changes

❌ **DON'T send:**
- Too frequently (max 3/day)
- Irrelevant marketing
- Non-urgent updates

### Notification Content
- Keep title under 50 characters
- Keep body under 120 characters
- Include clear call-to-action
- Use emojis sparingly

### Timing
- Respect user's timezone
- Avoid late night (10pm-8am)
- Send within 15 minutes of event
- Batch non-urgent messages

---

## 9. Troubleshooting

### Permission Denied
- User must grant permission manually
- Explain benefits before asking
- Don't ask repeatedly if denied

### Notifications Not Showing
1. Check browser compatibility
2. Verify HTTPS enabled
3. Confirm service worker registered
4. Check VAPID keys configured
5. Verify subscription saved to DB

### Notifications Not Clickable
- Ensure `data.url` is set
- Check `notificationclick` handler
- Verify URL is absolute path

---

## 10. Metrics & Analytics

Track notification performance:
```sql
-- Create analytics table
CREATE TABLE notification_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  notification_type TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMPTZ
);

-- Track click rate
SELECT 
  notification_type,
  COUNT(*) as total_sent,
  SUM(CASE WHEN clicked THEN 1 ELSE 0 END) as total_clicked,
  ROUND(AVG(CASE WHEN clicked THEN 1 ELSE 0 END) * 100, 2) as click_rate
FROM notification_analytics
GROUP BY notification_type;
```

---

## Next Steps
1. Generate VAPID keys
2. Update environment variables
3. Deploy edge function
4. Test on staging
5. Enable for users gradually
6. Monitor metrics

**Push notifications ready! 🔔**
