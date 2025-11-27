/**
 * Push Notification System
 * Real-time order status updates
 */

export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

class PushNotificationManager {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private permission: NotificationPermission = 'default';

  async init(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.ready;
      this.permission = Notification.permission;
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (this.permission === 'granted') return true;
    if (this.permission === 'denied') return false;

    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result === 'granted';
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  async subscribe(userId: string): Promise<PushSubscription | null> {
    if (!this.swRegistration) {
      await this.init();
    }

    if (this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) return null;
    }

    try {
      const existingSubscription = await this.swRegistration!.pushManager.getSubscription();
      if (existingSubscription) {
        return existingSubscription;
      }

      const subscription = await this.swRegistration!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: subscription.toJSON(),
        }),
      });

      return subscription;
    } catch (error) {
      console.error('Subscription failed:', error);
      return null;
    }
  }

  async unsubscribe(): Promise<boolean> {
    try {
      const subscription = await this.swRegistration?.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });
      }
      return true;
    } catch (error) {
      console.error('Unsubscribe failed:', error);
      return false;
    }
  }

  async showLocal(payload: NotificationPayload): Promise<void> {
    if (this.permission !== 'granted') return;

    const options: NotificationOptions = {
      body: payload.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: payload.tag,
      data: payload.data,
      vibrate: [100, 50, 100],
      requireInteraction: false,
    };

    if (this.swRegistration) {
      await this.swRegistration.showNotification(payload.title, options);
    } else {
      new Notification(payload.title, options);
    }
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

export const pushNotifications = new PushNotificationManager();

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    pushNotifications.init().then(() => {
      setPermission(Notification.permission);
    });
  }, []);

  const subscribe = useCallback(async (userId: string) => {
    const sub = await pushNotifications.subscribe(userId);
    setSubscription(sub);
    setPermission(Notification.permission);
    return sub;
  }, []);

  const unsubscribe = useCallback(async () => {
    const success = await pushNotifications.unsubscribe();
    if (success) {
      setSubscription(null);
    }
    return success;
  }, []);

  return {
    permission,
    subscription,
    subscribe,
    unsubscribe,
    isSupported: 'PushManager' in window,
  };
}

import { useState, useEffect, useCallback } from 'react';
