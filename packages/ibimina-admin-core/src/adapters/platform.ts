import type { StorageAdapter } from './storage-adapter';
import type { NotificationAdapter } from './notification-adapter';
import type { PrintAdapter } from './print-adapter';
import type { HardwareAdapter } from './hardware-adapter';

export interface PlatformInfo {
  type: 'web' | 'mobile' | 'desktop';
  os: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web';
  version: string;
  isOnline: boolean;
}

export interface PlatformAdapter {
  info: PlatformInfo;
  storage: StorageAdapter;
  notifications: NotificationAdapter;
  printing: PrintAdapter;
  hardware: HardwareAdapter;
  initialize(): Promise<void>;
  isFeatureAvailable(feature: PlatformFeature): boolean;
  openExternal(url: string): Promise<void>;
  getAppVersion(): string;
  checkForUpdates?(): Promise<UpdateInfo | null>;
  installUpdate?(): Promise<void>;
}

export type PlatformFeature =
  | 'offline-storage'
  | 'push-notifications'
  | 'biometrics'
  | 'nfc'
  | 'barcode-scanner'
  | 'printing'
  | 'auto-update'
  | 'system-tray'
  | 'deep-linking';

export interface UpdateInfo {
  version: string;
  releaseNotes: string;
  releaseDate: string;
  mandatory: boolean;
}
