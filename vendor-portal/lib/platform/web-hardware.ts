import type { HardwareAdapter } from '@ibimina/admin-core/adapters';

export class WebHardware implements HardwareAdapter {
  scanner = {
    isSupported: (): boolean => {
      return 'BarcodeDetector' in window;
    },

    startScan: async (): Promise<void> => {
      // Would need to request camera access and use BarcodeDetector API
      console.warn('Barcode scanning not yet implemented for web');
    },

    stopScan: async (): Promise<void> => {
      console.warn('Barcode scanning not yet implemented for web');
    },

    onScan: (callback: (result: any) => void): (() => void) => {
      return () => {
        // Cleanup
      };
    },
  };

  nfc = {
    isSupported: (): boolean => {
      return 'NDEFReader' in window;
    },

    isEnabled: async (): Promise<boolean> => {
      // Web NFC requires explicit permission check
      return 'NDEFReader' in window;
    },

    startReading: async (): Promise<void> => {
      if (!('NDEFReader' in window)) {
        throw new Error('NFC not supported');
      }
      // Would use NDEFReader API here
      console.warn('NFC reading not yet implemented for web');
    },

    stopReading: async (): Promise<void> => {
      console.warn('NFC reading not yet implemented for web');
    },

    onRead: (callback: (data: any) => void): (() => void) => {
      return () => {};
    },
  };

  biometrics = {
    isSupported: (): boolean => {
      // Web has WebAuthn but we're not implementing it here
      return false;
    },

    isEnrolled: async (): Promise<boolean> => {
      return false;
    },

    authenticate: async (reason: string): Promise<boolean> => {
      throw new Error('Biometrics not supported on web');
    },
  };
}
