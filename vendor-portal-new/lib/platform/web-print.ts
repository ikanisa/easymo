import type {
  PrintAdapter,
  PrintOptions,
  ReceiptData,
  PrinterInfo,
} from '@ibimina/admin-core/adapters';

export class WebPrint implements PrintAdapter {
  isSupported(): boolean {
    return true; // Browser always supports printing
  }

  async printHtml(html: string, options?: PrintOptions): Promise<void> {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Failed to open print window');
    }

    const styles = `
      <style>
        @media print {
          @page {
            size: ${options?.paperSize === 'receipt' ? '80mm auto' : options?.paperSize || 'A4'};
            margin: 0;
          }
          body {
            margin: ${options?.paperSize === 'receipt' ? '5mm' : '10mm'};
          }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${options?.title || 'Print'}</title>
          ${styles}
        </head>
        <body>
          ${html}
        </body>
      </html>
    `);
    printWindow.document.close();

    // Wait for content to load
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }

  async printReceipt(data: ReceiptData): Promise<void> {
    const receiptHtml = this.generateReceiptHtml(data);
    await this.printHtml(receiptHtml, {
      title: 'Receipt',
      paperSize: 'receipt',
    });
  }

  async getPrinters(): Promise<PrinterInfo[]> {
    // Web browsers don't expose printer information
    return [
      {
        id: 'browser-default',
        name: 'System Default Printer',
        isDefault: true,
        status: 'ready',
        type: 'standard',
      },
    ];
  }

  async setDefaultPrinter(printerId: string): Promise<void> {
    // Web browsers don't allow setting default printer
    console.warn('Setting default printer not supported on web');
  }

  private generateReceiptHtml(data: ReceiptData): string {
    return `
      <div style="font-family: monospace; width: 280px; font-size: 12px;">
        <div style="text-align: center; margin-bottom: 10px;">
          <strong>${data.header}</strong>
        </div>
        <div style="border-top: 1px dashed #000; padding: 10px 0;">
          ${data.items
            .map(
              (item) => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>${item.description}</span>
              <span>${item.quantity} x ${item.amount.toLocaleString()}</span>
            </div>
          `,
            )
            .join('')}
        </div>
        <div style="border-top: 1px dashed #000; padding: 10px 0;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span>
            <span>${data.subtotal.toLocaleString()}</span>
          </div>
          ${
            data.tax
              ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Tax:</span>
              <span>${data.tax.toLocaleString()}</span>
            </div>
          `
              : ''
          }
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px;">
            <span>Total:</span>
            <span>${data.total.toLocaleString()}</span>
          </div>
        </div>
        ${
          data.footer
            ? `
          <div style="text-align: center; margin-top: 10px; font-size: 10px;">
            ${data.footer}
          </div>
        `
            : ''
        }
      </div>
    `;
  }
}
