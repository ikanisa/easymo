import type {
  NotificationAdapter,
  NotificationOptions,
} from '@ibimina/admin-core/adapters';

export class WebNotifications implements NotificationAdapter {
  isSupported(): boolean {
    return 'Notification' in window;
  }

  async requestPermission(): Promise<'granted' | 'denied' | 'default'> {
    if (!this.isSupported()) {
      return 'denied';
    }
    return await Notification.requestPermission();
  }

  async getPermissionStatus(): Promise<'granted' | 'denied' | 'default'> {
    if (!this.isSupported()) {
      return 'denied';
    }
    return Notification.permission;
  }

  async show(options: NotificationOptions): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Notifications not supported');
    }

    const permission = await this.getPermissionStatus();
    if (permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon,
      data: options.data,
      silent: !options.sound,
    });

    // Return a unique ID based on timestamp
    return `notif-${Date.now()}`;
  }

  async cancel(id: string): Promise<void> {
    // Web Notification API doesn't provide a way to cancel by ID
    // Notifications auto-dismiss after a few seconds anyway
    console.warn('Canceling individual notifications not supported on web');
  }

  async cancelAll(): Promise<void> {
    // Web Notification API doesn't provide a way to cancel all notifications
    console.warn('Canceling all notifications not supported on web');
  }
}
