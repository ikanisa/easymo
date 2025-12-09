export interface ScanResult {
  type: 'barcode' | 'qrcode';
  format: string;
  data: string;
  timestamp: Date;
}

export interface ScannerAdapter {
  isSupported(): boolean;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  onScan(callback: (result: ScanResult) => void): () => void;
}

export interface NfcData {
  id: string;
  type: string;
  payload: string;
}

export interface NfcAdapter {
  isSupported(): boolean;
  isEnabled(): Promise<boolean>;
  startReading(): Promise<void>;
  stopReading(): Promise<void>;
  onRead(callback: (data: NfcData) => void): () => void;
}

export interface BiometricsAdapter {
  isSupported(): boolean;
  isEnrolled(): Promise<boolean>;
  authenticate(reason: string): Promise<boolean>;
}

export interface HardwareAdapter {
  scanner: ScannerAdapter;
  nfc: NfcAdapter;
  biometrics: BiometricsAdapter;
}
