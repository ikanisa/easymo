import type { HardwareAdapter } from '@ibimina/admin-core/adapters';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

interface BarcodeResult {
  format: string;
  data: string;
  timestamp: number;
}

interface NFCTag {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface BiometricResult {
  success: boolean;
  method: 'fingerprint' | 'face' | 'pin';
  userId?: string;
}

export class EnhancedTauriHardware implements HardwareAdapter {
  private barcodeListeners: Set<(result: BarcodeResult) => void> = new Set();
  private nfcListeners: Set<(tag: NFCTag) => void> = new Set();
  private unlistenBarcode?: UnlistenFn;
  private unlistenNfc?: UnlistenFn;

  async initialize(): Promise<void> {
    // Set up event listeners
    this.unlistenBarcode = await listen<BarcodeResult>('barcode-scanned', (event) => {
      this.barcodeListeners.forEach(listener => listener(event.payload));
    });

    this.unlistenNfc = await listen<NFCTag>('nfc-detected', (event) => {
      this.nfcListeners.forEach(listener => listener(event.payload));
    });
  }

  async cleanup(): Promise<void> {
    this.unlistenBarcode?.();
    this.unlistenNfc?.();
    this.barcodeListeners.clear();
    this.nfcListeners.clear();
  }

  // Barcode Scanner
  barcode = {
    isAvailable: async (): Promise<boolean> => {
      try {
        return await invoke<boolean>('is_scanner_available');
      } catch (error) {
        console.error('Barcode scanner availability check failed:', error);
        return false;
      }
    },

    startScanning: async (): Promise<void> => {
      try {
        await invoke('start_barcode_scan');
      } catch (error) {
        console.error('Failed to start barcode scanning:', error);
        throw new Error('Failed to start barcode scanner');
      }
    },

    stopScanning: async (): Promise<void> => {
      try {
        await invoke('stop_barcode_scan');
      } catch (error) {
        console.error('Failed to stop barcode scanning:', error);
      }
    },

    onScan: (callback: (result: BarcodeResult) => void): (() => void) => {
      this.barcodeListeners.add(callback);
      return () => this.barcodeListeners.delete(callback);
    },

    scanOnce: async (): Promise<BarcodeResult> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Scan timeout'));
        }, 30000);

        const cleanup = this.barcode.onScan((result) => {
          clearTimeout(timeout);
          cleanup();
          resolve(result);
        });

        this.barcode.startScanning().catch((err) => {
          clearTimeout(timeout);
          cleanup();
          reject(err);
        });
      });
    },
  };

  // NFC Reader
  nfc = {
    isAvailable: async (): Promise<boolean> => {
      try {
        return await invoke<boolean>('is_nfc_available');
      } catch (error) {
        console.error('NFC availability check failed:', error);
        return false;
      }
    },

    startReading: async (): Promise<void> => {
      try {
        await invoke('start_nfc_reading');
      } catch (error) {
        console.error('Failed to start NFC reading:', error);
        throw new Error('Failed to start NFC reader');
      }
    },

    stopReading: async (): Promise<void> => {
      try {
        await invoke('stop_nfc_reading');
      } catch (error) {
        console.error('Failed to stop NFC reading:', error);
      }
    },

    onTagDetected: (callback: (tag: NFCTag) => void): (() => void) => {
      this.nfcListeners.add(callback);
      return () => this.nfcListeners.delete(callback);
    },

    writeTag: async (tagId: string, data: Record<string, unknown>): Promise<void> => {
      try {
        await invoke('write_nfc_tag', { tagId, data });
      } catch (error) {
        console.error('Failed to write NFC tag:', error);
        throw new Error('Failed to write to NFC tag');
      }
    },
  };

  // Biometrics (Windows Hello, Touch ID, etc.)
  biometrics = {
    isAvailable: async (): Promise<boolean> => {
      try {
        return await invoke<boolean>('is_biometrics_available');
      } catch (error) {
        console.error('Biometrics availability check failed:', error);
        return false;
      }
    },

    getAvailableMethods: async (): Promise<string[]> => {
      try {
        return await invoke<string[]>('get_biometric_methods');
      } catch (error) {
        console.error('Failed to get biometric methods:', error);
        return [];
      }
    },

    authenticate: async (reason: string): Promise<BiometricResult> => {
      try {
        return await invoke<BiometricResult>('authenticate_biometrics', { reason });
      } catch (error) {
        console.error('Biometric authentication failed:', error);
        throw new Error('Biometric authentication failed');
      }
    },

    enroll: async (userId: string): Promise<boolean> => {
      try {
        return await invoke<boolean>('enroll_biometrics', { userId });
      } catch (error) {
        console.error('Biometric enrollment failed:', error);
        return false;
      }
    },
  };

  // USB Devices
  usb = {
    listDevices: async (): Promise<USBDevice[]> => {
      try {
        return await invoke<USBDevice[]>('list_usb_devices');
      } catch (error) {
        console.error('Failed to list USB devices:', error);
        return [];
      }
    },

    onDeviceConnected: (callback: (device: USBDevice) => void): (() => void) => {
      let unlisten: UnlistenFn | undefined;
      
      listen<USBDevice>('usb-connected', (event) => {
        callback(event.payload);
      })
        .then(fn => unlisten = fn)
        .catch(err => console.error('Failed to listen for USB connected events:', err));
      
      return () => unlisten?.();
    },

    onDeviceDisconnected: (callback: (device: USBDevice) => void): (() => void) => {
      let unlisten: UnlistenFn | undefined;
      
      listen<USBDevice>('usb-disconnected', (event) => {
        callback(event.payload);
      })
        .then(fn => unlisten = fn)
        .catch(err => console.error('Failed to listen for USB disconnected events:', err));
      
      return () => unlisten?.();
    },
  };

  // Serial Ports (for receipt printers, etc.)
  serial = {
    listPorts: async (): Promise<SerialPortInfo[]> => {
      try {
        return await invoke<SerialPortInfo[]>('list_serial_ports');
      } catch (error) {
        console.error('Failed to list serial ports:', error);
        return [];
      }
    },

    open: async (path: string, baudRate: number): Promise<SerialConnection> => {
      try {
        const id = await invoke<string>('open_serial_port', { path, baudRate });
        return new TauriSerialConnection(id);
      } catch (error) {
        console.error('Failed to open serial port:', error);
        throw new Error('Failed to open serial port');
      }
    },
  };
}

interface USBDevice {
  vendorId: number;
  productId: number;
  name: string;
  serialNumber?: string;
}

interface SerialPortInfo {
  path: string;
  type: string;
  manufacturer?: string;
}

interface SerialConnection {
  write(data: Uint8Array): Promise<void>;
  read(): Promise<Uint8Array>;
  close(): Promise<void>;
}

class TauriSerialConnection implements SerialConnection {
  constructor(private id: string) {}

  async write(data: Uint8Array): Promise<void> {
    try {
      await invoke('serial_write', { id: this.id, data: Array.from(data) });
    } catch (error) {
      console.error('Failed to write to serial port:', error);
      throw new Error('Failed to write to serial port');
    }
  }

  async read(): Promise<Uint8Array> {
    try {
      const data = await invoke<number[]>('serial_read', { id: this.id });
      return new Uint8Array(data);
    } catch (error) {
      console.error('Failed to read from serial port:', error);
      throw new Error('Failed to read from serial port');
    }
  }

  async close(): Promise<void> {
    try {
      await invoke('serial_close', { id: this.id });
    } catch (error) {
      console.error('Failed to close serial port:', error);
      throw new Error('Failed to close serial port');
    }
  }
}
