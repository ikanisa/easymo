import type {
  PlatformAdapter,
  PlatformInfo,
  PlatformFeature,
  UpdateInfo,
} from '@ibimina/admin-core/adapters';
import { WebStorage } from './web-storage';
import { WebNotifications } from './web-notifications';
import { WebPrint } from './web-print';
import { WebHardware } from './web-hardware';

export class WebAdapter implements PlatformAdapter {
  public info: PlatformInfo;
  public storage: WebStorage;
  public notifications: WebNotifications;
  public printing: WebPrint;
  public hardware: WebHardware;

  constructor() {
    this.info = {
      type: 'web',
      os: 'web',
      version: '1.0.0',
      isOnline: navigator.onLine,
    };

    this.storage = new WebStorage();
    this.notifications = new WebNotifications();
    this.printing = new WebPrint();
    this.hardware = new WebHardware();
  }

  async initialize(): Promise<void> {
    // Initialize web platform features
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
      'push-notifications': 'Notification' in window && 'serviceWorker' in navigator,
      biometrics: false, // Web typically doesn't have biometrics (except WebAuthn)
      nfc: 'NDEFReader' in window, // Web NFC API
      'barcode-scanner': 'BarcodeDetector' in window,
      printing: true,
      'auto-update': 'serviceWorker' in navigator,
      'system-tray': false, // Web doesn't have system tray
      'deep-linking': true,
    };
    return features[feature] ?? false;
  }

  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  getAppVersion(): string {
    return process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';
  }

  async checkForUpdates(): Promise<UpdateInfo | null> {
    // For web apps, this would check for service worker updates
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        // If there's an update waiting, return update info
        if (registration.waiting) {
          return {
            version: this.getAppVersion(),
            releaseNotes: 'A new version is available',
            releaseDate: new Date().toISOString(),
            mandatory: false,
          };
        }
      }
    }
    return null;
  }

  async installUpdate(): Promise<void> {
    // For web apps, activate the waiting service worker
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }
  }
}
