/**
 * Advanced Printer Management System
 * Supports thermal receipt printers, kitchen printers, and label printers
 */

export interface PrinterConfig {
  id: string;
  name: string;
  type: 'receipt' | 'kitchen' | 'label';
  connection: 'usb' | 'network' | 'bluetooth';
  address?: string;
  port?: number;
  paperWidth: 58 | 80 | 112; // mm
  encoding: 'utf-8' | 'gb2312' | 'cp437';
  isDefault: boolean;
  isEnabled: boolean;
}

export interface PrintJob {
  id: string;
  printer: PrinterConfig;
  content: string | Uint8Array;
  copies: number;
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
  status: 'pending' | 'printing' | 'completed' | 'failed';
  error?: string;
}

// ESC/POS Commands
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const COMMANDS = {
  // Initialize printer
  INIT: new Uint8Array([ESC, 0x40]),
  
  // Text formatting
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  UNDERLINE_ON: new Uint8Array([ESC, 0x2d, 0x01]),
  UNDERLINE_OFF: new Uint8Array([ESC, 0x2d, 0x00]),
  DOUBLE_HEIGHT: new Uint8Array([ESC, 0x21, 0x10]),
  DOUBLE_WIDTH: new Uint8Array([ESC, 0x21, 0x20]),
  DOUBLE_SIZE: new Uint8Array([ESC, 0x21, 0x30]),
  NORMAL_SIZE: new Uint8Array([ESC, 0x21, 0x00]),
  
  // Alignment
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  
  // Paper handling
  FEED_LINE: new Uint8Array([LF]),
  FEED_LINES: (n: number) => new Uint8Array([ESC, 0x64, n]),
  CUT_PAPER: new Uint8Array([GS, 0x56, 0x00]),
  CUT_PARTIAL: new Uint8Array([GS, 0x56, 0x01]),
  
  // Cash drawer
  OPEN_DRAWER: new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa]),
};

export class ReceiptBuilder {
  private buffer: number[] = [];
  private encoder = new TextEncoder();

  constructor(private config: PrinterConfig) {}

  private addBytes(bytes: Uint8Array) {
    this.buffer.push(...Array.from(bytes));
    return this;
  }

  private addText(text: string) {
    const encoded = this.encoder.encode(text);
    this.buffer.push(...Array.from(encoded));
    return this;
  }

  init() {
    return this.addBytes(COMMANDS.INIT);
  }

  text(text: string) {
    return this.addText(text).newLine();
  }

  bold() {
    return this.addBytes(COMMANDS.BOLD_ON);
  }

  normal() {
    return this.addBytes(COMMANDS.BOLD_OFF).addBytes(COMMANDS.NORMAL_SIZE);
  }

  doubleSize() {
    return this.addBytes(COMMANDS.DOUBLE_SIZE);
  }

  left() {
    return this.addBytes(COMMANDS.ALIGN_LEFT);
  }

  center() {
    return this.addBytes(COMMANDS.ALIGN_CENTER);
  }

  right() {
    return this.addBytes(COMMANDS.ALIGN_RIGHT);
  }

  newLine(count = 1) {
    for (let i = 0; i < count; i++) {
      this.addBytes(COMMANDS.FEED_LINE);
    }
    return this;
  }

  separator(char = '-') {
    const width = this.config.paperWidth === 58 ? 32 : 48;
    return this.text(char.repeat(width));
  }

  cut() {
    return this.newLine(3).addBytes(COMMANDS.CUT_PAPER);
  }

  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export class PrinterManager {
  private printers: Map<string, PrinterConfig> = new Map();
  private printQueue: PrintJob[] = [];
  private isProcessing = false;

  async addPrinter(config: Omit<PrinterConfig, 'id'>): Promise<PrinterConfig> {
    const printer: PrinterConfig = {
      ...config,
      id: `printer-${Date.now()}`,
    };
    
    this.printers.set(printer.id, printer);
    return printer;
  }

  getDefaultPrinter(type: PrinterConfig['type']): PrinterConfig | undefined {
    return Array.from(this.printers.values()).find(
      (p) => p.type === type && p.isDefault && p.isEnabled
    );
  }

  async printReceipt(order: any): Promise<void> {
    const printer = this.getDefaultPrinter('receipt');
    if (!printer) throw new Error('No receipt printer configured');

    const builder = new ReceiptBuilder(printer);
    
    builder
      .init()
      .center()
      .bold()
      .doubleSize()
      .text(order.venue?.name || 'Restaurant')
      .normal()
      .text(order.venue?.address || '')
      .newLine()
      .separator()
      .left()
      .bold()
      .text(`Order #${order.order_number}`)
      .normal()
      .text(`Table: ${order.table_number || 'Takeaway'}`)
      .newLine()
      .separator();
    
    // Items
    order.items?.forEach((item: any) => {
      builder.text(`${item.quantity}x ${item.name}`);
      if (item.modifiers) {
        item.modifiers.forEach((mod: string) => {
          builder.text(`  + ${mod}`);
        });
      }
    });
    
    builder
      .separator()
      .right()
      .text(`Total: ${order.total} RWF`)
      .newLine(3)
      .cut();
    
    return this.print(printer, builder.build());
  }

  async printKitchenTicket(order: any): Promise<void> {
    const printer = this.getDefaultPrinter('kitchen');
    if (!printer) throw new Error('No kitchen printer configured');

    const builder = new ReceiptBuilder(printer);
    
    builder
      .init()
      .center()
      .bold()
      .doubleSize()
      .text(`Order #${order.order_number}`)
      .normal()
      .text(`Table ${order.table_number}`)
      .newLine()
      .separator()
      .left();
    
    order.items?.forEach((item: any) => {
      builder
        .bold()
        .doubleSize()
        .text(`${item.quantity}x`)
        .normal()
        .text(`${item.name}`);
      
      if (item.special_instructions) {
        builder.text(`** ${item.special_instructions} **`);
      }
      builder.newLine();
    });
    
    builder
      .newLine(3)
      .cut();
    
    return this.print(printer, builder.build());
  }

  private async print(printer: PrinterConfig, content: Uint8Array): Promise<void> {
    // This would be implemented with Tauri commands in production
    console.log('Printing to:', printer.name, content);
  }
}

// Singleton instance
export const printerManager = new PrinterManager();

// Hook for components
export function usePrinter() {
  return {
    printReceipt: (order: any) => printerManager.printReceipt(order),
    printKitchenTicket: (order: any) => printerManager.printKitchenTicket(order),
  };
}
