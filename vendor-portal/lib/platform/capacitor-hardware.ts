import type { HardwareAdapter } from '@ibimina/admin-core/adapters';
import { Capacitor } from '@capacitor/core';

export class CapacitorHardware implements HardwareAdapter {
  scanner = {
    isSupported: (): boolean => {
      // Would need a barcode scanner plugin like @capacitor-community/barcode-scanner
      return Capacitor.isNativePlatform();
    },

    startScan: async (): Promise<void> => {
      // TODO: Implement using barcode scanner plugin
      throw new Error('Barcode scanning not yet implemented');
    },

    stopScan: async (): Promise<void> => {
      throw new Error('Barcode scanning not yet implemented');
    },

    onScan: (callback: (result: any) => void): (() => void) => {
      return () => {};
    },
  };

  nfc = {
    isSupported: (): boolean => {
      // NFC is primarily available on Android
      return Capacitor.getPlatform() === 'android';
    },

    isEnabled: async (): Promise<boolean> => {
      // TODO: Check NFC hardware status
      return false;
    },

    startReading: async (): Promise<void> => {
      // TODO: Implement using NFC plugin
      throw new Error('NFC not yet implemented');
    },

    stopReading: async (): Promise<void> => {
      throw new Error('NFC not yet implemented');
    },

    onRead: (callback: (data: any) => void): (() => void) => {
      return () => {};
    },
  };

  biometrics = {
    isSupported: (): boolean => {
      // Would need a biometrics plugin
      return Capacitor.isNativePlatform();
    },

    isEnrolled: async (): Promise<boolean> => {
      // TODO: Check if biometrics are enrolled
      return false;
    },

    authenticate: async (reason: string): Promise<boolean> => {
      // TODO: Implement biometric authentication
      throw new Error('Biometrics not yet implemented');
    },
  };
}
