import type {
  NotificationAdapter,
  NotificationOptions,
} from '@ibimina/admin-core/adapters';
import {
  LocalNotifications,
  type ScheduleOptions,
} from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

export class CapacitorNotifications implements NotificationAdapter {
  isSupported(): boolean {
    return true; // Capacitor always supports notifications on native platforms
  }

  async requestPermission(): Promise<'granted' | 'denied' | 'default'> {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted' ? 'granted' : 'denied';
  }

  async getPermissionStatus(): Promise<'granted' | 'denied' | 'default'> {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted' ? 'granted' : 'denied';
  }

  async show(options: NotificationOptions): Promise<string> {
    const id = Date.now();
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: options.title,
          body: options.body,
          iconColor: options.icon,
          extra: options.data,
          sound: options.sound ? undefined : null,
        },
      ],
    });
    return id.toString();
  }

  async cancel(id: string): Promise<void> {
    await LocalNotifications.cancel({
      notifications: [{ id: parseInt(id, 10) }],
    });
  }

  async cancelAll(): Promise<void> {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  }
}
