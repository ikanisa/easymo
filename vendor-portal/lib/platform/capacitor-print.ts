import type {
  PrintAdapter,
  PrintOptions,
  ReceiptData,
  PrinterInfo,
} from '@ibimina/admin-core/adapters';

export class CapacitorPrint implements PrintAdapter {
  isSupported(): boolean {
    // Mobile printing support varies by platform
    // Would need a Capacitor plugin for native printing
    return false;
  }

  async printHtml(html: string, options?: PrintOptions): Promise<void> {
    // TODO: Implement using a Capacitor printing plugin
    // or fall back to sharing the content
    throw new Error('Printing not yet implemented for mobile');
  }

  async printReceipt(data: ReceiptData): Promise<void> {
    // TODO: Implement receipt printing for mobile
    // Could use Bluetooth thermal printers or share as PDF
    throw new Error('Receipt printing not yet implemented for mobile');
  }

  async getPrinters(): Promise<PrinterInfo[]> {
    // TODO: Enumerate available printers (WiFi, Bluetooth)
    return [];
  }

  async setDefaultPrinter(printerId: string): Promise<void> {
    throw new Error('Setting default printer not supported on mobile');
  }
}
