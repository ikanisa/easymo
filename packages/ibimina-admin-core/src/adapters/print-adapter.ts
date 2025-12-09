export interface PrintOptions {
  title?: string;
  copies?: number;
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'a4' | 'letter' | 'receipt';
}

export interface ReceiptData {
  header: string;
  items: Array<{ description: string; quantity: number; amount: number }>;
  subtotal: number;
  tax?: number;
  total: number;
  footer?: string;
}

export interface PrinterInfo {
  id: string;
  name: string;
  isDefault: boolean;
  status: 'ready' | 'busy' | 'offline' | 'error';
  type: 'standard' | 'thermal' | 'label';
}

export interface PrintAdapter {
  isSupported(): boolean;
  printHtml(html: string, options?: PrintOptions): Promise<void>;
  printReceipt(data: ReceiptData): Promise<void>;
  getPrinters(): Promise<PrinterInfo[]>;
  setDefaultPrinter(printerId: string): Promise<void>;
}
