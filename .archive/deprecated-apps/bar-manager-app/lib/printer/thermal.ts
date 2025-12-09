/**
 * Thermal Printer System
 * ESC/POS command generation for thermal receipt and kitchen printers
 */

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\n';

export interface PrinterConfig {
  id: string;
  name: string;
  type: 'receipt' | 'kitchen' | 'label';
  paperWidth: 58 | 80;
  encoding: 'utf-8' | 'cp437';
  autocut: boolean;
  cashdrawer: boolean;
}

export class ReceiptBuilder {
  private commands: string[] = [];
  private config: PrinterConfig;

  constructor(config: PrinterConfig) {
    this.config = config;
  }

  // Initialize printer
  init(): this {
    this.commands.push(ESC + '@'); // Reset printer
    return this;
  }

  // Text alignment
  left(): this {
    this.commands.push(ESC + 'a' + '\x00');
    return this;
  }

  center(): this {
    this.commands.push(ESC + 'a' + '\x01');
    return this;
  }

  right(): this {
    this.commands.push(ESC + 'a' + '\x02');
    return this;
  }

  // Text formatting
  bold(enable = true): this {
    this.commands.push(ESC + 'E' + (enable ? '\x01' : '\x00'));
    return this;
  }

  underline(enable = true): this {
    this.commands.push(ESC + '-' + (enable ? '\x01' : '\x00'));
    return this;
  }

  doubleWidth(): this {
    this.commands.push(ESC + '!' + '\x20');
    return this;
  }

  doubleHeight(): this {
    this.commands.push(ESC + '!' + '\x10');
    return this;
  }

  doubleSize(): this {
    this.commands.push(ESC + '!' + '\x30');
    return this;
  }

  normal(): this {
    this.commands.push(ESC + '!' + '\x00');
    return this;
  }

  // Font size
  fontSize(size: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): this {
    const value = ((size - 1) << 4) | (size - 1);
    this.commands.push(GS + '!' + String.fromCharCode(value));
    return this;
  }

  // Add text
  text(content: string): this {
    this.commands.push(content + LF);
    return this;
  }

  // Add line without newline
  write(content: string): this {
    this.commands.push(content);
    return this;
  }

  // New line
  newLine(count = 1): this {
    for (let i = 0; i < count; i++) {
      this.commands.push(LF);
    }
    return this;
  }

  // Separator line
  separator(char = '-'): this {
    const width = this.config.paperWidth === 58 ? 32 : 48;
    this.commands.push(char.repeat(width) + LF);
    return this;
  }

  // Draw line
  drawLine(char = '='): this {
    return this.separator(char);
  }

  // Two-column text
  columns(left: string, right: string): this {
    const width = this.config.paperWidth === 58 ? 32 : 48;
    const leftWidth = width - right.length;
    const leftText = left.substring(0, leftWidth).padEnd(leftWidth);
    this.commands.push(leftText + right + LF);
    return this;
  }

  // Three-column text
  columns3(left: string, center: string, right: string): this {
    const width = this.config.paperWidth === 58 ? 32 : 48;
    const colWidth = Math.floor(width / 3);
    const l = left.substring(0, colWidth).padEnd(colWidth);
    const c = center.substring(0, colWidth).padEnd(colWidth);
    const r = right.substring(0, colWidth);
    this.commands.push(l + c + r + LF);
    return this;
  }

  // QR Code
  qrCode(data: string, size = 6): this {
    // Set QR code size
    this.commands.push(GS + '(k' + '\x03\x00' + '1C' + String.fromCharCode(size));
    
    // Set error correction level (L=48, M=49, Q=50, H=51)
    this.commands.push(GS + '(k' + '\x03\x00' + '1E' + '1');
    
    // Store data
    const len = data.length + 3;
    this.commands.push(
      GS + '(k' +
      String.fromCharCode(len & 0xff) +
      String.fromCharCode((len >> 8) & 0xff) +
      '1P0' + data
    );
    
    // Print QR code
    this.commands.push(GS + '(k' + '\x03\x00' + '1Q0');
    
    return this;
  }

  // Barcode
  barcode(data: string, type: 'CODE39' | 'CODE128' | 'EAN13' = 'CODE128'): this {
    const types = {
      CODE39: 4,
      CODE128: 73,
      EAN13: 67,
    };

    // Set barcode height
    this.commands.push(GS + 'h' + '\x64'); // 100 dots

    // Set barcode width
    this.commands.push(GS + 'w' + '\x02'); // 2 dots

    // Print barcode
    this.commands.push(
      GS + 'k' +
      String.fromCharCode(types[type]) +
      String.fromCharCode(data.length) +
      data
    );

    return this;
  }

  // Feed paper
  feed(lines = 1): this {
    this.commands.push(ESC + 'd' + String.fromCharCode(lines));
    return this;
  }

  // Cut paper
  cut(partial = false): this {
    if (this.config.autocut) {
      this.commands.push(GS + 'V' + (partial ? '\x01' : '\x00'));
    }
    return this;
  }

  // Open cash drawer
  openDrawer(): this {
    if (this.config.cashdrawer) {
      this.commands.push(ESC + 'p' + '\x00' + '\x19' + '\xfa');
    }
    return this;
  }

  // Build final command string
  build(): string {
    return this.commands.join('');
  }

  // Build as bytes for direct printing
  buildBytes(): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(this.build());
  }
}

/**
 * Receipt Templates
 */
export class ReceiptTemplates {
  static customerReceipt(
    order: any,
    venue: any,
    config: PrinterConfig
  ): string {
    const builder = new ReceiptBuilder(config);

    builder
      .init()
      // Header
      .center()
      .bold()
      .doubleSize()
      .text(venue.name)
      .normal()
      .text(venue.address)
      .text(`Tel: ${venue.phone}`)
      .newLine()
      .separator()
      
      // Order info
      .left()
      .bold()
      .text(`Order #${order.order_number}`)
      .normal()
      .text(`Date: ${new Date(order.created_at).toLocaleString()}`)
      .text(`Table: ${order.table_number || 'Takeaway'}`)
      .text(`Server: ${order.server_name || 'N/A'}`)
      .newLine()
      .separator();

    // Items
    order.items.forEach((item: any) => {
      const qty = String(item.quantity).padStart(2);
      const price = String(item.price).padStart(8);
      builder.columns(`${qty} ${item.name}`, price);

      if (item.modifiers?.length) {
        item.modifiers.forEach((mod: string) => {
          builder.text(`   + ${mod}`);
        });
      }
    });

    builder
      .separator()
      // Totals
      .right()
      .columns('Subtotal:', `${order.subtotal} RWF`)
      .columns('Tax (18%):', `${order.tax || 0} RWF`)
      .bold()
      .fontSize(2)
      .columns('TOTAL:', `${order.total} RWF`)
      .normal()
      .newLine()
      
      // Payment
      .left()
      .text(`Payment: ${order.payment_method || 'Cash'}`)
      .newLine()
      
      // Footer
      .center()
      .text('Thank you for your visit!')
      .text('Please come again')
      .newLine()
      
      // QR code for feedback
      .qrCode(`https://feedback.venue.com/order/${order.id}`, 4)
      .newLine(2)
      
      .feed(3)
      .cut();

    return builder.build();
  }

  static kitchenTicket(
    order: any,
    config: PrinterConfig
  ): string {
    const builder = new ReceiptBuilder(config);

    builder
      .init()
      // Header - LARGE
      .center()
      .bold()
      .fontSize(4)
      .text(`ORDER #${order.order_number}`)
      .normal()
      .fontSize(2)
      .text(order.table_number ? `TABLE ${order.table_number}` : 'TAKEAWAY')
      .normal()
      .text(new Date(order.created_at).toLocaleTimeString())
      .newLine()
      .drawLine('=');

    // Items - LARGE for kitchen
    builder.left().fontSize(2);

    order.items.forEach((item: any) => {
      builder
        .bold()
        .text(`${item.quantity}× ${item.name}`)
        .normal();

      if (item.modifiers?.length) {
        item.modifiers.forEach((mod: string) => {
          builder.text(`  + ${mod}`);
        });
      }

      if (item.special_instructions) {
        builder
          .bold()
          .text(`  ⚠️ ${item.special_instructions}`)
          .normal();
      }

      builder.newLine();
    });

    builder
      .normal()
      .drawLine('=');

    // Order type & notes
    if (order.notes) {
      builder
        .bold()
        .text('NOTES:')
        .normal()
        .text(order.notes)
        .newLine();
    }

    builder
      .center()
      .fontSize(1)
      .text(`Server: ${order.server_name || 'N/A'}`)
      .newLine(3)
      .feed(2)
      .cut();

    return builder.build();
  }

  static endOfDayReport(
    data: any,
    venue: any,
    config: PrinterConfig
  ): string {
    const builder = new ReceiptBuilder(config);

    builder
      .init()
      .center()
      .bold()
      .fontSize(2)
      .text('END OF DAY REPORT')
      .normal()
      .fontSize(1)
      .text(venue.name)
      .text(new Date().toLocaleDateString())
      .newLine()
      .separator()
      
      // Summary
      .left()
      .bold()
      .text('SUMMARY')
      .normal()
      .columns('Total Orders:', String(data.total_orders))
      .columns('Total Sales:', `${data.total_sales} RWF`)
      .columns('Total Tax:', `${data.total_tax} RWF`)
      .newLine()
      
      // By payment method
      .bold()
      .text('BY PAYMENT METHOD')
      .normal();

    Object.entries(data.by_payment_method || {}).forEach(([method, amount]) => {
      builder.columns(method, `${amount} RWF`);
    });

    builder
      .newLine()
      .separator()
      
      // Top items
      .bold()
      .text('TOP SELLING ITEMS')
      .normal();

    (data.top_items || []).slice(0, 5).forEach((item: any, i: number) => {
      builder.text(`${i + 1}. ${item.name} (${item.quantity} sold)`);
    });

    builder
      .newLine()
      .separator()
      .center()
      .text('Report generated at')
      .text(new Date().toLocaleString())
      .newLine(3)
      .feed(2)
      .cut();

    return builder.build();
  }
}

/**
 * Print Queue Manager
 */
export class PrintQueue {
  private queue: Array<{
    id: string;
    printer: PrinterConfig;
    content: string;
    priority: number;
    timestamp: Date;
  }> = [];

  private processing = false;

  async add(
    printer: PrinterConfig,
    content: string,
    priority: number = 0
  ): Promise<void> {
    const job = {
      id: `print-${Date.now()}`,
      printer,
      content,
      priority,
      timestamp: new Date(),
    };

    // Insert by priority
    const index = this.queue.findIndex(j => j.priority < priority);
    if (index === -1) {
      this.queue.push(job);
    } else {
      this.queue.splice(index, 0, job);
    }

    // Start processing if not already
    if (!this.processing) {
      this.process();
    }
  }

  private async process(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      try {
        await this.print(job.printer, job.content);
        console.log(`✅ Printed job ${job.id}`);
      } catch (error) {
        console.error(`❌ Print failed for job ${job.id}:`, error);
        // Could retry or move to failed queue
      }

      // Small delay between jobs
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.processing = false;
  }

  private async print(printer: PrinterConfig, content: string): Promise<void> {
    // In browser, use Web Serial API or send to backend
    // For now, we'll log to console
    console.log(`🖨️ Printing to ${printer.name}:`);
    console.log(content);

    // In production, you would:
    // 1. Use Web Serial API for USB printers
    // 2. Send to network printer via WebSocket/HTTP
    // 3. Use Tauri to access system printers
    
    // Example with fetch to backend:
    // await fetch('/api/print', {
    //   method: 'POST',
    //   body: JSON.stringify({ printer: printer.id, content }),
    // });
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

// Global print queue instance
export const printQueue = new PrintQueue();

/**
 * Helper functions
 */
export function printReceipt(order: any, venue: any, printer: PrinterConfig): void {
  const content = ReceiptTemplates.customerReceipt(order, venue, printer);
  printQueue.add(printer, content, 1);
}

export function printKitchenTicket(order: any, printer: PrinterConfig): void {
  const content = ReceiptTemplates.kitchenTicket(order, printer);
  printQueue.add(printer, content, 2); // Higher priority
}

export function printEndOfDay(data: any, venue: any, printer: PrinterConfig): void {
  const content = ReceiptTemplates.endOfDayReport(data, venue, printer);
  printQueue.add(printer, content, 0);
}
