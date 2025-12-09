// Platform-specific type definitions
// Will be implemented in future phases

export type Platform = 'web' | 'mobile' | 'desktop';

export type OS = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web';

export interface PlatformCapabilities {
  offlineStorage: boolean;
  pushNotifications: boolean;
  biometrics: boolean;
  nfc: boolean;
  barcodeScanner: boolean;
  printing: boolean;
  autoUpdate: boolean;
  systemTray: boolean;
  deepLinking: boolean;
}
