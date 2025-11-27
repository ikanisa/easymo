declare module 'qr-scanner' {
  export interface QrScannerOptions {
    onDecodeError?: (error: Error | string) => void;
    calculateScanRegion?: (video: HTMLVideoElement) => ScanRegion;
    preferredCamera?: 'environment' | 'user';
    maxScansPerSecond?: number;
    highlightScanRegion?: boolean;
    highlightCodeOutline?: boolean;
    overlay?: HTMLDivElement;
  }

  export interface ScanRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    downScaledWidth?: number;
    downScaledHeight?: number;
  }

  export interface Point {
    x: number;
    y: number;
  }

  export interface ScanResult {
    data: string;
    cornerPoints?: Point[];
  }

  export default class QrScanner {
    constructor(
      video: HTMLVideoElement,
      onDecode: (result: ScanResult) => void,
      options?: QrScannerOptions
    );

    start(): Promise<void>;
    stop(): void;
    pause(): void;
    setCamera(cameraId: string): Promise<void>;
    hasCamera(): Promise<boolean>;

    static scanImage(
      imageOrFileOrUrl: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | File | URL | string,
      options?: {
        scanRegion?: ScanRegion;
        qrEngine?: any;
        alsoTryWithoutScanRegion?: boolean;
      }
    ): Promise<ScanResult>;

    static hasCamera(): Promise<boolean>;
    static listCameras(preferFrontCameras?: boolean): Promise<Array<{ id: string; label: string }>>;
  }
}
