export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  sound?: boolean;
  data?: Record<string, unknown>;
}

export interface NotificationAdapter {
  isSupported(): boolean;
  requestPermission(): Promise<'granted' | 'denied' | 'default'>;
  getPermissionStatus(): Promise<'granted' | 'denied' | 'default'>;
  show(options: NotificationOptions): Promise<string>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
}
