import type {
  PlatformAdapter,
  PlatformInfo,
  PlatformFeature,
  UpdateInfo,
} from '@ibimina/admin-core/adapters';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { CapacitorStorage } from './capacitor-storage';
import { CapacitorNotifications } from './capacitor-notifications';
import { CapacitorPrint } from './capacitor-print';
import { CapacitorHardware } from './capacitor-hardware';

export class CapacitorAdapter implements PlatformAdapter {
  public info: PlatformInfo;
  public storage: CapacitorStorage;
  public notifications: CapacitorNotifications;
  public printing: CapacitorPrint;
  public hardware: CapacitorHardware;

  constructor() {
    this.info = {
      type: 'mobile',
      os: this.getOS(),
      version: '0.1.0',
      isOnline: navigator.onLine,
    };

    this.storage = new CapacitorStorage();
    this.notifications = new CapacitorNotifications();
    this.printing = new CapacitorPrint();
    this.hardware = new CapacitorHardware();
  }

  async initialize(): Promise<void> {
    // Get device info
    const info = await Device.getInfo();
    this.info.version = info.osVersion;

    // Monitor network status
    window.addEventListener('online', () => {
      this.info.isOnline = true;
    });
    window.addEventListener('offline', () => {
      this.info.isOnline = false;
    });
  }

  isFeatureAvailable(feature: PlatformFeature): boolean {
    const features: Record<PlatformFeature, boolean> = {
      'offline-storage': true,
      'push-notifications': true,
      biometrics: Capacitor.isNativePlatform(),
      nfc: Capacitor.getPlatform() === 'android', // iOS has NFC but limited API
      'barcode-scanner': true,
      printing: true,
      'auto-update': false, // Mobile apps update via app stores
      'system-tray': false, // Mobile doesn't have system tray
      'deep-linking': true,
    };
    return features[feature] ?? false;
  }

  async openExternal(url: string): Promise<void> {
    // Use Capacitor Browser plugin or shell
    window.open(url, '_blank');
  }

  getAppVersion(): string {
    return '0.1.0'; // TODO: Get from app config
  }

  async checkForUpdates(): Promise<UpdateInfo | null> {
    // Mobile apps are updated via app stores
    // This could check for in-app updates or CodePush
    return null;
  }

  async installUpdate(): Promise<void> {
    // Not applicable for mobile apps - users update via app stores
    throw new Error('Updates are managed via app stores');
  }

  private getOS(): 'android' | 'ios' | 'web' {
    const platform = Capacitor.getPlatform();
    if (platform === 'android') return 'android';
    if (platform === 'ios') return 'ios';
    return 'web';
  }
}
